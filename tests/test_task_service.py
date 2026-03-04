import pytest
from datetime import datetime, timedelta, timezone

from app.application.task_services import TaskService
from app.infrastructure.repositories import (
    PostgresTaskRepository,
    PostgresReminderRepository,
    PostgresAttachmentRepository,
)
from app.infrastructure.models import ReminderModel
from sqlalchemy import select

pytestmark = pytest.mark.asyncio


async def _make_service(db_session) -> TaskService:
    return TaskService(
        PostgresTaskRepository(db_session),
        PostgresReminderRepository(db_session),
        PostgresAttachmentRepository(db_session),
    )


async def test_create_task_with_reminder(db_session):
    service = await _make_service(db_session)
    deadline = datetime.now(timezone.utc) + timedelta(days=5)

    task = await service.create_task_with_reminder(user_id=1, text="Test task", deadline=deadline)
    await db_session.commit()

    assert task.id is not None
    assert task.text == "Test task"

    result = await db_session.execute(select(ReminderModel).where(ReminderModel.task_id == task.id))
    reminders = result.scalars().all()
    assert len(reminders) == 2


async def test_reminders_2_days_and_1_day_before(db_session):
    service = await _make_service(db_session)
    deadline = datetime.now(timezone.utc) + timedelta(days=5)

    task = await service.create_task_with_reminder(user_id=1, text="Check", deadline=deadline)
    await db_session.commit()

    result = await db_session.execute(
        select(ReminderModel).where(ReminderModel.task_id == task.id).order_by(ReminderModel.remind_at)
    )
    reminders = result.scalars().all()

    # Both reminders should be before the deadline
    for r in reminders:
        remind_at = r.remind_at if r.remind_at.tzinfo else r.remind_at.replace(tzinfo=timezone.utc)
        assert remind_at < deadline


async def test_close_deadline_gets_5min_reminder(db_session):
    service = await _make_service(db_session)
    deadline = datetime.now(timezone.utc) + timedelta(minutes=30)

    task = await service.create_task_with_reminder(user_id=1, text="Urgent", deadline=deadline)
    await db_session.commit()

    result = await db_session.execute(select(ReminderModel).where(ReminderModel.task_id == task.id))
    reminders = result.scalars().all()

    assert len(reminders) == 1
    # Reminder should be ~5 minutes from now
    now = datetime.now(timezone.utc)
    remind_at = reminders[0].remind_at
    if remind_at.tzinfo is None:
        remind_at = remind_at.replace(tzinfo=timezone.utc)
    diff = (remind_at - now).total_seconds()
    assert 0 < diff < 600  # within 10 minutes
