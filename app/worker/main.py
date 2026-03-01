import asyncio
import logging
from aiogram import Bot
from app.core.config import settings
from app.infrastructure.database import AsyncSessionLocal
from app.infrastructure.repositories import PostgresReminderRepository

# Настройка логирования для Production
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

async def process_reminders(bot: Bot) -> int:
    """Обрабатывает пачку напоминаний. Возвращает количество отправленных."""
    processed_count = 0
    
    # Открываем сессию (транзакцию) БД
    async with AsyncSessionLocal() as session:
        repo = PostgresReminderRepository(session)
        
        try:
            reminders = await repo.get_pending_and_lock(limit=50)
            
            if not reminders:
                return 0

            for item in reminders:
                try:
                    await bot.send_message(
                        chat_id=item["user_id"], 
                        text=f"🚨 <b>Напоминание о дедлайне!</b>\n\n📝 Задача: <i>{item['text']}</i>",
                        parse_mode="HTML"
                    )
                    await repo.mark_as_sent(item["reminder_id"])
                    processed_count += 1
                except Exception as e:
                    logger.error(f"Failed to send reminder {item['reminder_id']} to {item['user_id']}: {e}")
            
            await session.commit()
            return processed_count
            
        except Exception as db_err:
            await session.rollback()
            logger.error(f"Database error during processing: {db_err}")
            raise db_err

async def worker_loop():
    logger.info("🚀 Background Notification Worker started...")
    bot = Bot(token=settings.BOT_TOKEN)
    
    try:
        while True:
            try:
                sent_count = await process_reminders(bot)
                
                sleep_time = 10 if sent_count == 0 else 0.1
                
                if sent_count > 0:
                    logger.info(f"✅ Sent {sent_count} reminders. Next check in {sleep_time}s.")
                    
                await asyncio.sleep(sleep_time)
                
            except Exception as e:
                logger.critical(f"❌ Worker loop critical error: {e}")
                await asyncio.sleep(10) # При критической ошибке (например, БД упала) ждем 10 сек
    finally:
        # Корректное закрытие сессии бота при остановке контейнера
        await bot.session.close()
        logger.info("🛑 Worker stopped gracefully.")

if __name__ == "__main__":
    try:
        asyncio.run(worker_loop())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Process interrupted by user/system.")