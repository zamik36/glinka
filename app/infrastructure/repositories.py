from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.domain.interfaces import TaskRepository, ReminderRepository
from app.domain.entities import Task, Reminder
from app.infrastructure.models import TaskModel, ReminderModel

class PostgresTaskRepository(TaskRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, task: Task) -> Task:
        db_task = TaskModel(user_id=task.user_id, text=task.text, deadline=task.deadline)
        self.session.add(db_task)
        await self.session.flush() # Получаем ID без коммита
        task.id = db_task.id
        return task

    async def get_by_user(self, user_id: int) -> list[Task]:
        stmt = select(TaskModel).where(TaskModel.user_id == user_id).order_by(TaskModel.deadline)
        result = await self.session.execute(stmt)
        return [Task(**row.__dict__) for row in result.scalars().all()]

class PostgresReminderRepository(ReminderRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, reminder: Reminder) -> Reminder:
        db_reminder = ReminderModel(task_id=reminder.task_id, remind_at=reminder.remind_at)
        self.session.add(db_reminder)
        return reminder

    async def get_pending_and_lock(self, limit: int = 100) -> list[dict]:
        """
        Используем SQLAlchemy ORM для выборки с блокировкой.
        Возвращаем словарь, чтобы передать воркеру не только ID, но и Telegram ID пользователя и текст задачи.
        """
        # FOR UPDATE SKIP LOCKED с блокировкой ТОЛЬКО таблицы reminders
        stmt = (
            select(ReminderModel, TaskModel)
            .join(TaskModel, ReminderModel.task_id == TaskModel.id)
            .where(
                ReminderModel.is_sent == False,
                ReminderModel.remind_at <= func.now()
            )
            .order_by(ReminderModel.remind_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True, of=ReminderModel) # Блокируем только напоминания!
        )
        
        result = await self.session.execute(stmt)
        rows = result.all()
        
        # Собираем DTO для воркера
        pending_reminders = []
        for reminder, task in rows:
            pending_reminders.append({
                "reminder_id": reminder.id,
                "user_id": task.user_id,
                "text": task.text
            })
            
        return pending_reminders

    async def mark_as_sent(self, reminder_id: int) -> None:
        stmt = (
            update(ReminderModel)
            .where(ReminderModel.id == reminder_id)
            .values(is_sent=True)
        )
        await self.session.execute(stmt)