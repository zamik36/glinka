from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from app.domain.entities import Task, Reminder, Attachment


class TaskRepository(ABC):
    @abstractmethod
    async def create(self, task: Task) -> Task:
        pass

    @abstractmethod
    async def get_by_user(self, user_id: int) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    async def get_by_id(self, task_id: int) -> dict[str, Any] | None:
        pass

    @abstractmethod
    async def update(self, task_id: int, text: str, deadline: datetime) -> None:
        pass

    @abstractmethod
    async def delete(self, task_id: int) -> None:
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
    async def get_by_id_and_lock(self, reminder_id: int) -> dict[str, Any] | None:
        """Fetch a single unsent reminder with FOR UPDATE SKIP LOCKED."""
        pass

    @abstractmethod
    async def mark_as_sent(self, reminder_id: int) -> None:
        pass

    @abstractmethod
    async def delete_by_task(self, task_id: int) -> None:
        pass


class AttachmentRepository(ABC):
    @abstractmethod
    async def create(self, attachment: Attachment) -> Attachment:
        pass

    @abstractmethod
    async def get_by_task(self, task_id: int) -> list[Attachment]:
        pass

    @abstractmethod
    async def delete_by_task(self, task_id: int) -> list[str]:
        """Delete all attachments for a task, return stored_path list for cleanup."""
        pass
