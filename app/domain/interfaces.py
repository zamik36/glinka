from abc import ABC, abstractmethod
from typing import Any

from app.domain.entities import Task, Reminder, Attachment


class TaskRepository(ABC):
    @abstractmethod
    async def create(self, task: Task) -> Task:
        pass

    @abstractmethod
    async def get_by_user(self, user_id: int) -> list[dict[str, Any]]:
        pass


class ReminderRepository(ABC):
    @abstractmethod
    async def create(self, reminder: Reminder) -> Reminder:
        pass

    @abstractmethod
    async def get_pending_and_lock(self, limit: int) -> list[dict[str, Any]]:
        """Для HighLoad воркера: берет задачи и блокирует их от других воркеров"""
        pass

    @abstractmethod
    async def mark_as_sent(self, reminder_id: int) -> None:
        pass


class AttachmentRepository(ABC):
    @abstractmethod
    async def create(self, attachment: Attachment) -> Attachment:
        pass

    @abstractmethod
    async def get_by_task(self, task_id: int) -> list[Attachment]:
        pass
