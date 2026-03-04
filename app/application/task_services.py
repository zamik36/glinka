from datetime import timedelta, datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.domain.entities import Task, Reminder, Attachment
from app.domain.interfaces import TaskRepository, ReminderRepository, AttachmentRepository
from app.infrastructure.file_storage import FileStorageService

class TaskService:
    def __init__(
        self,
        task_repo: TaskRepository,
        reminder_repo: ReminderRepository,
        attachment_repo: AttachmentRepository,
        file_storage: FileStorageService | None = None,
    ):
        self.task_repo = task_repo
        self.reminder_repo = reminder_repo
        self.attachment_repo = attachment_repo
        self.file_storage = file_storage

    async def create_task_with_reminder(
        self, user_id: int, text: str, deadline: datetime, attachments: list[Attachment] | None = None
    ) -> Task:
        task = Task(user_id=user_id, text=text, deadline=deadline)
        created_task = await self.task_repo.create(task)

        now = datetime.now(timezone.utc)

        remind_times = []
        for days_before in [2, 1]:
            remind_date = deadline - timedelta(days=days_before)
            remind_dt = remind_date.replace(hour=15, minute=0, second=0, microsecond=0)
            if remind_dt.tzinfo is None:
                remind_dt = remind_dt.replace(tzinfo=timezone.utc)
            if remind_dt > now:
                remind_times.append(remind_dt)

        if not remind_times:
            remind_times.append(now + timedelta(minutes=5))

        assert created_task.id is not None

        for rt in remind_times:
            reminder = Reminder(task_id=created_task.id, remind_at=rt)
            await self.reminder_repo.create(reminder)

        if attachments:
            for att in attachments:
                att.task_id = created_task.id
                await self.attachment_repo.create(att)

        return created_task

    async def update_task(self, task_id: int, user_id: int, text: str, deadline: datetime) -> None:
        task = await self.task_repo.get_by_id(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        await self.task_repo.update(task_id, text, deadline)

        # Re-schedule reminders
        await self.reminder_repo.delete_by_task(task_id)
        now = datetime.now(timezone.utc)
        remind_times = []
        for days_before in [2, 1]:
            remind_date = deadline - timedelta(days=days_before)
            remind_dt = remind_date.replace(hour=15, minute=0, second=0, microsecond=0)
            if remind_dt.tzinfo is None:
                remind_dt = remind_dt.replace(tzinfo=timezone.utc)
            if remind_dt > now:
                remind_times.append(remind_dt)
        if not remind_times:
            remind_times.append(now + timedelta(minutes=5))
        for rt in remind_times:
            await self.reminder_repo.create(Reminder(task_id=task_id, remind_at=rt))

    async def delete_task(self, task_id: int, user_id: int) -> None:
        task = await self.task_repo.get_by_id(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        # Clean up attachment files
        paths = await self.attachment_repo.delete_by_task(task_id)
        if self.file_storage:
            for path in paths:
                self.file_storage.delete(path)

        # Cascade will handle reminders, but delete explicitly for clarity
        await self.reminder_repo.delete_by_task(task_id)
        await self.task_repo.delete(task_id)

    async def get_user_tasks(self, user_id: int) -> list[dict[str, Any]]:
        return await self.task_repo.get_by_user(user_id)
