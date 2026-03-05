from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base


class TaskModel(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    text: Mapped[str] = mapped_column(String(2000))
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_completed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    reminders: Mapped[list["ReminderModel"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    attachments: Mapped[list["AttachmentModel"]] = relationship(back_populates="task", cascade="all, delete-orphan")


class ReminderModel(Base):
    __tablename__ = "reminders"
    __table_args__ = (Index('ix_reminders_pending', 'is_sent', 'remind_at'),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    remind_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    is_sent: Mapped[bool] = mapped_column(default=False, index=True)

    task: Mapped["TaskModel"] = relationship(back_populates="reminders")


class AttachmentModel(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(500))
    stored_path: Mapped[str] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(200))
    size: Mapped[int] = mapped_column()

    task: Mapped["TaskModel"] = relationship(back_populates="attachments")
