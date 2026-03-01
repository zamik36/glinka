from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime
from app.presentation.dependencies import get_current_user, get_task_service
from app.application.task_services import TaskService
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.database import get_db_session

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

class TaskCreateRequest(BaseModel):
    text: str
    deadline: datetime

@router.post("")
async def create_task(
    request: TaskCreateRequest,
    user_id: int = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
    session: AsyncSession = Depends(get_db_session)
):
    task = await service.create_task_with_reminder(user_id, request.text, request.deadline)
    await session.commit() # Коммит транзакции происходит на уровне контроллера API
    return {"status": "success", "task_id": task.id}

@router.get("")
async def get_tasks(
    user_id: int = Depends(get_current_user),
    service: TaskService = Depends(get_task_service)
):
    return await service.get_user_tasks(user_id)