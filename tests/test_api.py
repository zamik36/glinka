import pytest
from datetime import datetime, timedelta, timezone

from tests.conftest import FAKE_USER_ID

pytestmark = pytest.mark.asyncio


async def test_create_task_success(client):
    deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    resp = await client.post("/api/tasks", data={"text": "New task", "deadline": deadline})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert "task_id" in body


async def test_create_task_invalid_deadline(client):
    resp = await client.post("/api/tasks", data={"text": "Bad", "deadline": "not-a-date"})
    assert resp.status_code == 400


async def test_create_task_past_deadline(client):
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    resp = await client.post("/api/tasks", data={"text": "Late", "deadline": past})
    assert resp.status_code == 400


async def test_get_tasks(client):
    deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    await client.post("/api/tasks", data={"text": "Task 1", "deadline": deadline})

    resp = await client.get("/api/tasks")
    assert resp.status_code == 200
    tasks = resp.json()
    assert len(tasks) >= 1
    assert tasks[0]["text"] == "Task 1"


async def test_unauthorized_request(db_session):
    from httpx import ASGITransport, AsyncClient
    from main_api import app
    from app.infrastructure.database import get_db_session

    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db_session] = _override_db
    # Do NOT override get_current_user — should require auth
    if "get_current_user" in str(app.dependency_overrides):
        from app.presentation.dependencies import get_current_user
        app.dependency_overrides.pop(get_current_user, None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/tasks")
    assert resp.status_code == 401

    app.dependency_overrides.clear()
