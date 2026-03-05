"""add composite index on reminders and FK indexes

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-03-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e5f6g7h8i9j0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6g7h8i9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_reminders_pending', 'reminders', ['is_sent', 'remind_at'])
    op.create_index('ix_reminders_task_id', 'reminders', ['task_id'])
    op.create_index('ix_attachments_task_id', 'attachments', ['task_id'])


def downgrade() -> None:
    op.drop_index('ix_attachments_task_id', table_name='attachments')
    op.drop_index('ix_reminders_task_id', table_name='reminders')
    op.drop_index('ix_reminders_pending', table_name='reminders')
