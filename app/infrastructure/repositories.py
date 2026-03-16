from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload
from app.domain.interfaces import TaskRepository, ReminderRepository, AttachmentRepository
from app.domain.entities import Task, Reminder, Attachment, ReminderStatus
from app.infrastructure.models import TaskModel, ReminderModel, AttachmentModel

class PostgresTaskRepository(TaskRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, task: Task) -> Task:
        db_task = TaskModel(user_id=task.user_id, text=task.text, deadline=task.deadline)
        self.session.add(db_task)
        await self.session.flush()
        task.id = db_task.id
        return task

    async def get_by_user(self, user_id: int, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        stmt = (
            select(TaskModel)
            .options(
                selectinload(TaskModel.attachments),
                selectinload(TaskModel.reminders),
            )
            .where(TaskModel.user_id == user_id)
            .order_by(TaskModel.deadline)
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        tasks = []
        for row in result.scalars().all():
            statuses = [r.status for r in row.reminders]
            if not statuses:
                reminder_status = None
            elif all(s == ReminderStatus.SENT for s in statuses):
                reminder_status = ReminderStatus.SENT
            else:
                reminder_status = ReminderStatus.PENDING
            task_dict = {
                "id": row.id,
                "user_id": row.user_id,
                "text": row.text,
                "deadline": row.deadline,
                "is_completed": row.is_completed,
                "created_at": row.created_at,
                "reminder_status": reminder_status,
                "attachments": [
                    {
                        "id": a.id,
                        "task_id": a.task_id,
                        "filename": a.filename,
                        "stored_path": a.stored_path,
                        "mime_type": a.mime_type,
                        "size": a.size,
                    }
                    for a in row.attachments
                ],
                "reminders": [
                    {
                        "id": r.id,
                        "remind_at": r.remind_at,
                        "status": r.status,
                    }
                    for r in row.reminders
                ],
            }
            tasks.append(task_dict)
        return tasks

    async def get_by_id(self, task_id: int, for_update: bool = False) -> dict[str, Any] | None:
        stmt = (
            select(TaskModel)
            .options(selectinload(TaskModel.attachments))
            .where(TaskModel.id == task_id)
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        if row is None:
            return None
        return {
            "id": row.id,
            "user_id": row.user_id,
            "text": row.text,
            "deadline": row.deadline,
            "is_completed": row.is_completed,
            "created_at": row.created_at,
            "attachments": [
                {
                    "id": a.id,
                    "task_id": a.task_id,
                    "filename": a.filename,
                    "stored_path": a.stored_path,
                    "mime_type": a.mime_type,
                    "size": a.size,
                }
                for a in row.attachments
            ],
        }

    async def update(self, task_id: int, text: str, deadline: datetime) -> None:
        stmt = (
            update(TaskModel)
            .where(TaskModel.id == task_id)
            .values(text=text, deadline=deadline)
        )
        await self.session.execute(stmt)

    async def delete(self, task_id: int) -> None:
        stmt = delete(TaskModel).where(TaskModel.id == task_id)
        await self.session.execute(stmt)

    async def toggle_complete(self, task_id: int, is_completed: bool) -> None:
        stmt = update(TaskModel).where(TaskModel.id == task_id).values(is_completed=is_completed)
        await self.session.execute(stmt)

class PostgresReminderRepository(ReminderRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, reminder: Reminder) -> Reminder:
        db_reminder = ReminderModel(task_id=reminder.task_id, remind_at=reminder.remind_at)
        self.session.add(db_reminder)
        return reminder

    async def get_by_id_and_lock(self, reminder_id: int) -> dict[str, Any] | None:
        stmt = (
            select(ReminderModel, TaskModel)
            .join(TaskModel, ReminderModel.task_id == TaskModel.id)
            .where(
                ReminderModel.id == reminder_id,
                ReminderModel.status == ReminderStatus.PENDING,
            )
            .with_for_update(skip_locked=True, of=ReminderModel)
        )
        result = await self.session.execute(stmt)
        row = result.first()
        if row is None:
            return None
        reminder, task = row
        return {
            "reminder_id": reminder.id,
            "task_id": task.id,
            "user_id": task.user_id,
            "text": task.text,
            "remind_at": reminder.remind_at,
        }

    async def get_pending_and_lock(self, limit: int = 100) -> list[dict[str, Any]]:
        """
        Используем SQLAlchemy ORM для выборки с блокировкой.
        Возвращаем словарь, чтобы передать воркеру не только ID, но и Telegram ID пользователя и текст задачи.
        """
        stmt = (
            select(ReminderModel, TaskModel)
            .join(TaskModel, ReminderModel.task_id == TaskModel.id)
            .where(
                ReminderModel.status == ReminderStatus.PENDING,
                ReminderModel.remind_at <= func.now()
            )
            .order_by(ReminderModel.remind_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True, of=ReminderModel)
        )

        result = await self.session.execute(stmt)
        rows = result.all()

        pending_reminders = []
        for reminder, task in rows:
            pending_reminders.append({
                "reminder_id": reminder.id,
                "task_id": task.id,
                "user_id": task.user_id,
                "text": task.text,
            })

        return pending_reminders

    async def get_attachments_for_task(self, task_id: int) -> list[dict[str, Any]]:
        stmt = select(AttachmentModel).where(AttachmentModel.task_id == task_id)
        result = await self.session.execute(stmt)
        return [
            {
                "filename": a.filename,
                "stored_path": a.stored_path,
                "mime_type": a.mime_type,
            }
            for a in result.scalars().all()
        ]

    async def mark_as_sent(self, reminder_id: int) -> None:
        stmt = (
            update(ReminderModel)
            .where(ReminderModel.id == reminder_id)
            .values(status=ReminderStatus.SENT)
        )
        await self.session.execute(stmt)

    async def has_unsent_reminders(self, task_id: int) -> bool:
        stmt = (
            select(func.count())
            .select_from(ReminderModel)
            .where(ReminderModel.task_id == task_id, ReminderModel.status == ReminderStatus.PENDING)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one() > 0

    async def delete_by_task(self, task_id: int) -> None:
        stmt = delete(ReminderModel).where(ReminderModel.task_id == task_id)
        await self.session.execute(stmt)

class PostgresAttachmentRepository(AttachmentRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, attachment: Attachment) -> Attachment:
        db_attachment = AttachmentModel(
            task_id=attachment.task_id,
            filename=attachment.filename,
            stored_path=attachment.stored_path,
            mime_type=attachment.mime_type,
            size=attachment.size,
        )
        self.session.add(db_attachment)
        await self.session.flush()
        attachment.id = db_attachment.id
        return attachment

    async def get_by_task(self, task_id: int) -> list[Attachment]:
        stmt = select(AttachmentModel).where(AttachmentModel.task_id == task_id)
        result = await self.session.execute(stmt)
        return [
            Attachment(
                id=a.id,
                task_id=a.task_id,
                filename=a.filename,
                stored_path=a.stored_path,
                mime_type=a.mime_type,
                size=a.size,
            )
            for a in result.scalars().all()
        ]

    async def delete_by_task(self, task_id: int) -> list[str]:
        stmt = select(AttachmentModel.stored_path).where(AttachmentModel.task_id == task_id)
        result = await self.session.execute(stmt)
        paths = list(result.scalars().all())
        del_stmt = delete(AttachmentModel).where(AttachmentModel.task_id == task_id)
        await self.session.execute(del_stmt)
        return paths
