import asyncio
import logging
import os
from html import escape
from aiogram import Bot
from aiogram.types import FSInputFile, InputMediaPhoto, InputMediaDocument
from app.core.config import settings
from app.infrastructure.database import AsyncSessionLocal
from app.infrastructure.repositories import PostgresReminderRepository

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}

def is_image(mime_type: str, filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return mime_type.startswith("image/") or ext in IMAGE_EXTENSIONS


async def send_reminder_with_attachments(bot: Bot, chat_id: int, text: str, attachments: list[dict]):
    caption = f"\U0001f6a8 <b>Напоминание о дедлайне!</b>\n\n\U0001f4dd Задача: <i>{escape(text)}</i>"

    if not attachments:
        await bot.send_message(chat_id=chat_id, text=caption, parse_mode="HTML")
        return

    valid_attachments = []
    for att in attachments:
        full_path = os.path.join(settings.FILE_STORAGE_DIR, att["stored_path"])
        if os.path.exists(full_path):
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


async def process_reminders(bot: Bot) -> int:
    processed_count = 0

    async with AsyncSessionLocal() as session:
        repo = PostgresReminderRepository(session)

        try:
            reminders = await repo.get_pending_and_lock(limit=50)

            if not reminders:
                return 0

            for item in reminders:
                try:
                    attachments = await repo.get_attachments_for_task(item["task_id"])
                    await send_reminder_with_attachments(
                        bot, item["user_id"], item["text"], attachments
                    )
                    await repo.mark_as_sent(item["reminder_id"])
                    processed_count += 1

                    if not await repo.has_unsent_reminders(item["task_id"]):
                        await repo.mark_task_completed(item["task_id"])
                except Exception as e:
                    logger.error(f"Failed to send reminder {item['reminder_id']} to {item['user_id']}: {e}")

            await session.commit()
            return processed_count

        except Exception as db_err:
            await session.rollback()
            logger.error(f"Database error during processing: {db_err}")
            raise db_err

async def worker_loop():
    logger.info("Background Notification Worker started...")
    bot = Bot(token=settings.BOT_TOKEN)

    try:
        while True:
            try:
                sent_count = await process_reminders(bot)

                sleep_time = 10 if sent_count == 0 else 0.1

                if sent_count > 0:
                    logger.info(f"Sent {sent_count} reminders. Next check in {sleep_time}s.")

                await asyncio.sleep(sleep_time)

            except Exception as e:
                logger.critical(f"Worker loop critical error: {e}")
                await asyncio.sleep(10)
    finally:
        await bot.session.close()
        logger.info("Worker stopped gracefully.")

if __name__ == "__main__":
    try:
        asyncio.run(worker_loop())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Process interrupted by user/system.")
