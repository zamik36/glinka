from datetime import timedelta, datetime, timezone
from app.domain.entities import Task, Reminder
from app.domain.interfaces import TaskRepository, ReminderRepository

class TaskService:
    def __init__(self, task_repo: TaskRepository, reminder_repo: ReminderRepository):
        self.task_repo = task_repo
        self.reminder_repo = reminder_repo

    async def create_task_with_reminder(self, user_id: int, text: str, deadline: datetime) -> Task:
        task = Task(user_id=user_id, text=text, deadline=deadline)
        created_task = await self.task_repo.create(task)

        now = datetime.now(timezone.utc)

        # Напоминания за 2 дня и за 1 день до дедлайна в 18:00 МСК (15:00 UTC)
        remind_times = []
        for days_before in [2, 1]:
            remind_date = deadline - timedelta(days=days_before)
            remind_dt = remind_date.replace(hour=15, minute=0, second=0, microsecond=0)
            if remind_dt.tzinfo is None:
                remind_dt = remind_dt.replace(tzinfo=timezone.utc)
            if remind_dt > now:
                remind_times.append(remind_dt)

        # Если ни одно время не в будущем — через 5 минут
        if not remind_times:
            remind_times.append(now + timedelta(minutes=5))

        for rt in remind_times:
            reminder = Reminder(task_id=created_task.id, remind_at=rt)
            await self.reminder_repo.create(reminder)

        return created_task

    async def get_user_tasks(self, user_id: int) -> list[Task]:
        return await self.task_repo.get_by_user(user_id)