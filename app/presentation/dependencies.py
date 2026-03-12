import logging
from fastapi import Header, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.database import get_db_session
from app.infrastructure.repositories import PostgresTaskRepository, PostgresReminderRepository, PostgresAttachmentRepository
from app.infrastructure.file_storage import FileStorageService
from app.application.task_services import TaskService
from app.core.security import validate_telegram_data
from app.core.config import settings

logger = logging.getLogger("app.api.auth")

_file_storage = FileStorageService()

async def get_current_user(initData: str = Header(default="", alias="initData")) -> int:
    if not initData:
        if settings.DEBUG:
            logger.warning("Missing initData header in request")
        raise HTTPException(status_code=401, detail="Unauthorized: Missing Telegram initData")

    user_data = validate_telegram_data(initData)
    return user_data["id"]

def get_file_storage() -> FileStorageService:
    return _file_storage

async def get_task_service(
    session: AsyncSession = Depends(get_db_session),
    file_storage: FileStorageService = Depends(get_file_storage),
) -> TaskService:
    task_repo = PostgresTaskRepository(session)
    reminder_repo = PostgresReminderRepository(session)
    attachment_repo = PostgresAttachmentRepository(session)
    return TaskService(task_repo, reminder_repo, attachment_repo, file_storage)
