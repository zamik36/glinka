"""add reminder notify trigger

Revision ID: c3d4e5f6g7h8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c3d4e5f6g7h8'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create trigger function and trigger for LISTEN/NOTIFY on reminders INSERT."""
    op.execute("""
        CREATE OR REPLACE FUNCTION notify_reminder_insert()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_notify('reminder_new', json_build_object(
            'id', NEW.id,
            'remind_at', NEW.remind_at
          )::text);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_reminder_insert
          AFTER INSERT ON reminders
          FOR EACH ROW EXECUTE FUNCTION notify_reminder_insert();
    """)


def downgrade() -> None:
    """Drop trigger and function."""
    op.execute("DROP TRIGGER IF EXISTS trg_reminder_insert ON reminders;")
    op.execute("DROP FUNCTION IF EXISTS notify_reminder_insert();")
