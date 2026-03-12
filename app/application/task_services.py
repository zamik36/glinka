import asyncio
import logging
from datetime import timedelta, datetime, timezone
from typing import Any

from cachetools import TTLCache

from app.core.config import settings
from app.domain.entities import Task, Reminder, Attachment
from app.domain.exceptions import TaskNotFoundError, ForbiddenError
from app.domain.interfaces import TaskRepository, ReminderRepository, AttachmentRepository
from app.infrastructure.file_storage import FileStorageService

logger = logging.getLogger(__name__)

# Module-level cache: shared across all TaskService instances in the same process.
# Key: user_id (int), Value: list[dict] task list.
# TTL-based invalidation covers the case where the worker (separate process) marks
# a reminder as sent — eventual consistency within TASK_CACHE_TTL_SECONDS.
_task_cache: TTLCache = TTLCache(maxsize=1024, ttl=settings.TASK_CACHE_TTL_SECONDS)

REMIND_DAYS_BEFORE = [2, 1]
REMIND_HOUR = 15
DEFAULT_LIMIT = 50


def _calculate_remind_times(deadline: datetime) -> list[datetime]:
    now = datetime.now(timezone.utc)
    remind_times = []
    for days_before in REMIND_DAYS_BEFORE:
        remind_date = deadline - timedelta(days=days_before)
        remind_dt = remind_date.replace(hour=REMIND_HOUR, minute=0, second=0, microsecond=0)
        if remind_dt.tzinfo is None:
            remind_dt = remind_dt.replace(tzinfo=timezone.utc)
        if remind_dt > now:
            remind_times.append(remind_dt)
    if not remind_times:
        remind_times.append(now + timedelta(minutes=5))
    return remind_times


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
        self, user_id: int, text: str, deadline: datetime,
        attachments: list[Attachment] | None = None,
        reminder_times: list[datetime] | None = None,
    ) -> Task:
        task = Task(user_id=user_id, text=text, deadline=deadline)
        created_task = await self.task_repo.create(task)

        if created_task.id is None:
            raise RuntimeError("Task creation failed: id is None after flush")

        times = reminder_times if reminder_times else _calculate_remind_times(deadline)
        for rt in times:
            reminder = Reminder(task_id=created_task.id, remind_at=rt)
            await self.reminder_repo.create(reminder)

        if attachments:
            for att in attachments:
                att.task_id = created_task.id
                await self.attachment_repo.create(att)

        self._invalidate_cache(user_id)
        return created_task

    async def update_task(
        self, task_id: int, user_id: int, text: str, deadline: datetime,
        reminder_times: list[datetime] | None = None,
    ) -> None:
        task = await self.task_repo.get_by_id(task_id, for_update=True)
        if task is None:
            raise TaskNotFoundError(task_id)
        if task["user_id"] != user_id:
            raise ForbiddenError(task_id)

        await self.task_repo.update(task_id, text, deadline)

        times = reminder_times if reminder_times else _calculate_remind_times(deadline)
        await self.reminder_repo.delete_by_task(task_id)
        for rt in times:
            await self.reminder_repo.create(Reminder(task_id=task_id, remind_at=rt))

        self._invalidate_cache(user_id)

    async def delete_task(self, task_id: int, user_id: int) -> None:
        task = await self.task_repo.get_by_id(task_id, for_update=True)
        if task is None:
            raise TaskNotFoundError(task_id)
        if task["user_id"] != user_id:
            raise ForbiddenError(task_id)

        paths = await self.attachment_repo.delete_by_task(task_id)
        if self.file_storage and paths:
            results = await asyncio.gather(
                *(self.file_storage.delete(p) for p in paths),
                return_exceptions=True,
            )
            for path, result in zip(paths, results):
                if isinstance(result, Exception):
                    logger.warning("Failed to delete file %s: %s", path, result)

        await self.reminder_repo.delete_by_task(task_id)
        await self.task_repo.delete(task_id)
        self._invalidate_cache(user_id)

    async def get_user_tasks(self, user_id: int, limit: int = DEFAULT_LIMIT, offset: int = 0) -> list[dict[str, Any]]:
        if limit == DEFAULT_LIMIT and offset == 0 and user_id in _task_cache:
            return _task_cache[user_id]
        result = await self.task_repo.get_by_user(user_id, limit=limit, offset=offset)
        if limit == DEFAULT_LIMIT and offset == 0:
            _task_cache[user_id] = list(result)  # store a copy to prevent external mutation
        return result

    def _invalidate_cache(self, user_id: int) -> None:
        _task_cache.pop(user_id, None)

    async def toggle_complete(self, task_id: int, user_id: int, is_completed: bool) -> None:
        task = await self.task_repo.get_by_id(task_id, for_update=True)
        if task is None:
            raise TaskNotFoundError(task_id)
        if task["user_id"] != user_id:
            raise ForbiddenError(task_id)
        await self.task_repo.toggle_complete(task_id, is_completed)
        self._invalidate_cache(user_id)
