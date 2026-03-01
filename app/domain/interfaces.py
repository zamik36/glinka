from abc import ABC, abstractmethod
from typing import List
from app.domain.entities import Task, Reminder

class TaskRepository(ABC):
    @abstractmethod
    async def create(self, task: Task) -> Task:
        pass

    @abstractmethod
    async def get_by_user(self, user_id: int) -> List[Task]:
        pass

class ReminderRepository(ABC):
    @abstractmethod
    async def create(self, reminder: Reminder) -> Reminder:
        pass
    
    @abstractmethod
    async def get_pending_and_lock(self, limit: int) -> List[Reminder]:
        """Для HighLoad воркера: берет задачи и блокирует их от других воркеров"""
        pass

    @abstractmethod
    async def mark_as_sent(self, reminder_id: int) -> None:
        pass    