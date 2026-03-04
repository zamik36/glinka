from datetime import datetime, timezone

from app.domain.entities import Task, Reminder, Attachment


def test_task_defaults():
    task = Task(user_id=1, text="Do homework", deadline=datetime(2026, 6, 1, tzinfo=timezone.utc))
    assert task.id is None
    assert task.is_completed is False
    assert task.user_id == 1
    assert task.text == "Do homework"


def test_reminder_defaults():
    reminder = Reminder(task_id=1, remind_at=datetime(2026, 5, 30, 15, 0, tzinfo=timezone.utc))
    assert reminder.id is None
    assert reminder.is_sent is False
    assert reminder.task_id == 1


def test_attachment_creation():
    att = Attachment(
        task_id=1,
        filename="report.pdf",
        stored_path="abc123.pdf",
        mime_type="application/pdf",
        size=1024,
    )
    assert att.id is None
    assert att.filename == "report.pdf"
    assert att.size == 1024
