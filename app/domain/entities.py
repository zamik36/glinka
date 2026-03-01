from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class User(BaseModel):
    tg_id: int
    username: Optional[str] = None
    timezone: str = "UTC"

class Task(BaseModel):
    id: Optional[int] = None
    user_id: int
    text: str
    deadline: datetime
    is_completed: bool = False

class Reminder(BaseModel):
    id: Optional[int] = None
    task_id: int
    remind_at: datetime
    is_sent: bool = False