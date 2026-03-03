from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base

class TaskModel(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, index=True, nullable=False)
    text = Column(String(2000), nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=False)
    is_completed = Column(Boolean, default=False)

    reminders = relationship("ReminderModel", back_populates="task", cascade="all, delete-orphan")
    attachments = relationship("AttachmentModel", back_populates="task", cascade="all, delete-orphan")

class ReminderModel(Base):
    __tablename__ = "reminders"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    remind_at = Column(DateTime(timezone=True), index=True, nullable=False)
    is_sent = Column(Boolean, default=False, index=True)

    task = relationship("TaskModel", back_populates="reminders")

class AttachmentModel(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(500), nullable=False)
    stored_path = Column(String(500), nullable=False)
    mime_type = Column(String(200), nullable=False)
    size = Column(Integer, nullable=False)

    task = relationship("TaskModel", back_populates="attachments")
