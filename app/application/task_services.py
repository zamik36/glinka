from datetime import timedelta, datetime
from app.domain.entities import Task, Reminder
from app.domain.interfaces import TaskRepository, ReminderRepository

class TaskService:
    def __init__(self, task_repo: TaskRepository, reminder_repo: ReminderRepository):
        self.task_repo = task_repo
        self.reminder_repo = reminder_repo

    async def create_task_with_reminder(self, user_id: int, text: str, deadline: datetime) -> Task:
        # 1. Создаем задачу
        task = Task(user_id=user_id, text=text, deadline=deadline)
        created_task = await self.task_repo.create(task)

        # 2. Бизнес-логика: создаем напоминание за 2 часа до дедлайна
        remind_time = deadline - timedelta(hours=2)
        reminder = Reminder(task_id=created_task.id, remind_at=remind_time)
        await self.reminder_repo.create(reminder)

        return created_task

    async def get_user_tasks(self, user_id: int) -> list[Task]:
        return await self.task_repo.get_by_user(user_id)