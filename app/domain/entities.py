from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class User(BaseModel):
    tg_id: int
    username: Optional[str] = None
    timezone: str = "UTC"

class Task(BaseModel):
    id: Optional[int] = None
    user_id: int
    text: str = Field(min_length=1, max_length=2000)
    deadline: datetime
    is_completed: bool = False

class Reminder(BaseModel):
    id: Optional[int] = None
    task_id: int
    remind_at: datetime
    is_sent: bool = False

class Attachment(BaseModel):
    id: Optional[int] = None
    task_id: int
    filename: str = Field(min_length=1, max_length=500)
    stored_path: str = Field(min_length=1, max_length=500)
    mime_type: str = Field(min_length=1, max_length=200)
    size: int = Field(gt=0, le=10_485_760)
