import asyncio
import json
import logging
import os
import signal
from datetime import datetime, timezone
from html import escape

import asyncpg
from aiogram import Bot
from aiogram.types import FSInputFile, InputMediaDocument, InputMediaPhoto
from prometheus_client import start_http_server

from app.core.config import settings
from app.core.logging_config import configure_logging
from app.infrastructure.database import AsyncSessionLocal
from app.infrastructure.repositories import PostgresReminderRepository
from app.worker.metrics import reminder_latency_seconds, reminders_failed_total, reminders_sent_total
from app.worker.scheduler import ReminderScheduler

configure_logging()
logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}

_LISTEN_RECONNECT_DELAY = 5


def is_image(mime_type: str, filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return mime_type.startswith("image/") or ext in IMAGE_EXTENSIONS


async def send_reminder_with_attachments(bot: Bot, chat_id: int, text: str, attachments: list[dict]):
    caption = f"Дедлайн на горизонте\U0001fae0\n\n\U0001f4dd Задача: <i>{escape(text)}</i>"

    if not attachments:
        await bot.send_message(chat_id=chat_id, text=caption, parse_mode="HTML")
        return

    valid_attachments = []
    for att in attachments:
        full_path = os.path.join(settings.FILE_STORAGE_DIR, att["stored_path"])
        if await asyncio.to_thread(os.path.exists, full_path):
            valid_attachments.append({**att, "full_path": full_path})

    if not valid_attachments:
        await bot.send_message(chat_id=chat_id, text=caption, parse_mode="HTML")
        return

    if len(valid_attachments) == 1:
        att = valid_attachments[0]
        file = FSInputFile(att["full_path"], filename=att["filename"])
        if is_image(att["mime_type"], att["filename"]):
            await bot.send_photo(chat_id=chat_id, photo=file, caption=caption, parse_mode="HTML")
        else:
            await bot.send_document(chat_id=chat_id, document=file, caption=caption, parse_mode="HTML")
        return

    media_group = []
    for i, att in enumerate(valid_attachments):
        file = FSInputFile(att["full_path"], filename=att["filename"])
        item_caption = caption if i == 0 else None
        if is_image(att["mime_type"], att["filename"]):
            media_group.append(InputMediaPhoto(media=file, caption=item_caption, parse_mode="HTML" if item_caption else None))
        else:
            media_group.append(InputMediaDocument(media=file, caption=item_caption, parse_mode="HTML" if item_caption else None))

    await bot.send_media_group(chat_id=chat_id, media=media_group)


async def _process_loop(
    bot: Bot,
    scheduler: ReminderScheduler,
    shutdown_event: asyncio.Event,
    semaphore: asyncio.Semaphore,
) -> None:
    async def _send_one(reminder_id: int) -> None:
        async with semaphore:
            async with AsyncSessionLocal() as session:
                repo = PostgresReminderRepository(session)
                try:
                    item = await repo.get_by_id_and_lock(reminder_id)
                    if item is None:
                        scheduler.mark_processed(reminder_id)
                        return

                    attachments = await repo.get_attachments_for_task(item["task_id"])
                    await send_reminder_with_attachments(bot, item["user_id"], item["text"], attachments)
                    await repo.mark_as_sent(item["reminder_id"])
                    await session.commit()
                    scheduler.mark_processed(reminder_id)

                    latency = (datetime.now(timezone.utc) - item["remind_at"]).total_seconds()
                    reminders_sent_total.inc()
                    reminder_latency_seconds.observe(latency)
                    logger.info("Sent reminder %d to user %d (latency=%.1fs)", reminder_id, item["user_id"], latency)

                except Exception as e:
                    await session.rollback()
                    scheduler.retry_one(reminder_id, delay_s=60.0)
                    reminders_failed_total.labels(reason=type(e).__name__).inc()
                    logger.error("Failed to send reminder %d, retrying in 60s: %s", reminder_id, e)

    while not shutdown_event.is_set():
        # Fix 8: try/except вокруг wait_for_next
        try:
            due_ids = await scheduler.wait_for_next()
        except Exception:
            logger.exception("Error in wait_for_next")
            continue

        if not due_ids:
            break  # shutdown signal

        # Fix 4: конкурентная отправка через semaphore
        await asyncio.gather(*[_send_one(rid) for rid in due_ids])


async def _listen_loop(
    scheduler: ReminderScheduler,
    shutdown_event: asyncio.Event,
) -> None:
    dsn = settings.DATABASE_URL.replace("+asyncpg", "")
    while not shutdown_event.is_set():
        conn: asyncpg.Connection | None = None
        try:
            conn = await asyncpg.connect(dsn)
            logger.info("LISTEN connection established")

            def _on_notify(
                conn: asyncpg.Connection,
                pid: int,
                channel: str,
                payload: str,
            ) -> None:
                try:
                    data = json.loads(payload)
                    reminder_id = int(data["id"])
                    remind_at = datetime.fromisoformat(data["remind_at"])
                    scheduler.add_one(reminder_id, remind_at)
                except Exception:
                    logger.exception("Bad NOTIFY payload: %s", payload)

            await conn.add_listener("reminder_new", _on_notify)

            # Block until shutdown
            while not shutdown_event.is_set():
                try:
                    await asyncio.wait_for(shutdown_event.wait(), timeout=60)
                    break
                except asyncio.TimeoutError:
                    pass

        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("LISTEN connection error, reconnecting in %ds", _LISTEN_RECONNECT_DELAY)
            try:
                await asyncio.wait_for(shutdown_event.wait(), timeout=_LISTEN_RECONNECT_DELAY)
                break
            except asyncio.TimeoutError:
                pass
        finally:
            if conn is not None:
                try:
                    await conn.close()
                except Exception:
                    pass


async def _fallback_sync_loop(
    scheduler: ReminderScheduler,
    shutdown_event: asyncio.Event,
) -> None:
    while not shutdown_event.is_set():
        try:
            async with AsyncSessionLocal() as session:
                await scheduler.load_from_db(session)

            stats = scheduler.stats
            logger.info("Fallback sync: heap=%d, known=%d", stats["heap_size"], stats["known_ids"])
        except Exception as e:
            logger.error("Fallback sync DB error: %s", e)

        try:
            await asyncio.wait_for(shutdown_event.wait(), timeout=settings.FALLBACK_SYNC_INTERVAL)
            break
        except asyncio.TimeoutError:
            pass


async def worker_loop():
    logger.info("Background Notification Worker started...")
    bot = Bot(token=settings.BOT_TOKEN)
    scheduler = ReminderScheduler()
    shutdown_event = asyncio.Event()

    # Fix 2: graceful shutdown via signals
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown_event.set)

    # Initial load
    try:
        async with AsyncSessionLocal() as session:
            await scheduler.load_from_db(session)
    except Exception as e:
        logger.error("Initial scheduler load failed: %s", e)

    # Fix 4: semaphore для ограничения конкурентности
    semaphore = asyncio.Semaphore(settings.WORKER_CONCURRENCY)

    try:
        # Fix 1: TaskGroup вместо gather
        async with asyncio.TaskGroup() as tg:
            tg.create_task(_process_loop(bot, scheduler, shutdown_event, semaphore))
            tg.create_task(_listen_loop(scheduler, shutdown_event))
            tg.create_task(_fallback_sync_loop(scheduler, shutdown_event))
    except* Exception as eg:
        for exc in eg.exceptions:
            logger.error("TaskGroup exception: %s", exc)
    finally:
        scheduler.shutdown()
        await bot.session.close()
        logger.info("Worker stopped gracefully.")


if __name__ == "__main__":
    start_http_server(9091)
    logger.info("Worker metrics server started on :9091")
    try:
        asyncio.run(worker_loop())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Process interrupted by user/system.")
