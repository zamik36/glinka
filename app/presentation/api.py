from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.presentation.dependencies import get_current_user, get_task_service, get_file_storage
from app.application.task_services import TaskService
from app.infrastructure.file_storage import FileStorageService
from app.domain.entities import Attachment
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.database import get_db_session

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

class AttachmentResponse(BaseModel):
    id: int
    filename: str
    mime_type: str
    size: int

class TaskResponse(BaseModel):
    id: int
    text: str
    deadline: datetime
    is_completed: bool
    created_at: datetime
    attachments: list[AttachmentResponse] = []

@router.post("")
@limiter.limit("20/minute")
async def create_task(
    request: Request,
    text: str = Form(..., min_length=1, max_length=2000),
    deadline: str = Form(...),
    files: list[UploadFile] = File(default=[]),
    user_id: int = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
    file_storage: FileStorageService = Depends(get_file_storage),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        deadline_dt = datetime.fromisoformat(deadline)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid deadline format")

    if deadline_dt.tzinfo is None:
        deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)

    if deadline_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Deadline must be in the future")

    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 files allowed")

    attachments: list[Attachment] = []
    for f in files:
        if f.filename and f.size is not None:
            stored_path, size = await file_storage.save(f)
            attachments.append(Attachment(
                task_id=0,
                filename=f.filename,
                stored_path=stored_path,
                mime_type=f.content_type or "application/octet-stream",
                size=size,
            ))

    task = await service.create_task_with_reminder(user_id, text, deadline_dt, attachments or None)
    await session.commit()
    return {"status": "success", "task_id": task.id}

@router.put("/{task_id}")
async def update_task(
    task_id: int,
    text: str = Form(..., min_length=1, max_length=2000),
    deadline: str = Form(...),
    user_id: int = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        deadline_dt = datetime.fromisoformat(deadline)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid deadline format")

    if deadline_dt.tzinfo is None:
        deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)

    if deadline_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Deadline must be in the future")

    await service.update_task(task_id, user_id, text, deadline_dt)
    await session.commit()
    return {"status": "success"}


@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    user_id: int = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
    session: AsyncSession = Depends(get_db_session),
):
    await service.delete_task(task_id, user_id)
    await session.commit()
    return {"status": "success"}


class CompletePayload(BaseModel):
    is_completed: bool


@router.patch("/{task_id}/complete")
async def toggle_task_complete(
    task_id: int,
    payload: CompletePayload,
    user_id: int = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
    session: AsyncSession = Depends(get_db_session),
):
    await service.toggle_complete(task_id, user_id, payload.is_completed)
    await session.commit()
    return {"status": "success"}


@router.get("", response_model=list[TaskResponse])
async def get_tasks(
    user_id: int = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return await service.get_user_tasks(user_id)
