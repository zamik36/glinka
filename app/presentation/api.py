from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from app.presentation.dependencies import get_current_user, get_task_service
from app.application.task_services import TaskService
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.database import get_db_session

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

class TaskCreateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    deadline: datetime

class TaskResponse(BaseModel):
    id: int
    text: str
    deadline: datetime
    is_completed: bool

@router.post("")
async def create_task(
    request: TaskCreateRequest,
    user_id: int = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
    session: AsyncSession = Depends(get_db_session)
):
    if request.deadline <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Deadline must be in the future")
    task = await service.create_task_with_reminder(user_id, request.text, request.deadline)
    await session.commit()
    return {"status": "success", "task_id": task.id}

@router.get("", response_model=list[TaskResponse])
async def get_tasks(
    user_id: int = Depends(get_current_user),
    service: TaskService = Depends(get_task_service)
):
    return await service.get_user_tasks(user_id)
