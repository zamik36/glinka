"""replace is_sent bool with status varchar on reminders

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-03-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f6g7h8i9j0k1'
down_revision: Union[str, Sequence[str], None] = 'e5f6g7h8i9j0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new status column with default 'pending'
    op.add_column('reminders',
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'))
    # 2. Back-fill: rows previously is_sent=True become 'sent'
    op.execute("UPDATE reminders SET status = 'sent' WHERE is_sent = TRUE")
    # 3. Add check constraint
    op.create_check_constraint(
        'ck_reminders_status',
        'reminders',
        "status IN ('pending', 'sent')"
    )
    # 4. Drop old composite index that referenced is_sent
    op.drop_index('ix_reminders_pending', table_name='reminders')
    # 5. Drop old single-column index on is_sent
    op.drop_index('ix_reminders_is_sent', table_name='reminders')
    # 6. Drop is_sent column
    op.drop_column('reminders', 'is_sent')
    # 7. Create composite index on (status, remind_at).
    # This also satisfies status-only queries via index prefix — no separate
    # single-column index on status is needed (avoids redundant write overhead).
    op.create_index('ix_reminders_status_remind_at', 'reminders', ['status', 'remind_at'])


def downgrade() -> None:
    op.drop_index('ix_reminders_status_remind_at', table_name='reminders')
    op.add_column('reminders',
        sa.Column('is_sent', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute("UPDATE reminders SET is_sent = TRUE WHERE status = 'sent'")
    op.drop_check_constraint('ck_reminders_status', table_name='reminders')
    op.drop_column('reminders', 'status')
    op.create_index('ix_reminders_is_sent', 'reminders', ['is_sent'])
    op.create_index('ix_reminders_pending', 'reminders', ['is_sent', 'remind_at'])
