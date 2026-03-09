import io
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


# ─── CRUD: update / delete / toggle ──────────────────────────────────────────

async def _create_task(client) -> int:
    deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    resp = await client.post("/api/tasks", data={"text": "My task", "deadline": deadline})
    assert resp.status_code == 200
    return resp.json()["task_id"]


async def test_update_task_success(client):
    task_id = await _create_task(client)
    new_deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    resp = await client.put(f"/api/tasks/{task_id}", data={"text": "Updated", "deadline": new_deadline})
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


async def test_delete_task_success(client):
    task_id = await _create_task(client)
    resp = await client.delete(f"/api/tasks/{task_id}")
    assert resp.status_code == 200
    # Task should no longer appear in list
    tasks = (await client.get("/api/tasks")).json()
    assert all(t["id"] != task_id for t in tasks)


async def test_toggle_complete_success(client):
    task_id = await _create_task(client)
    resp = await client.patch(f"/api/tasks/{task_id}/complete", json={"is_completed": True})
    assert resp.status_code == 200
    tasks = (await client.get("/api/tasks")).json()
    task = next(t for t in tasks if t["id"] == task_id)
    assert task["is_completed"] is True


# ─── Authorization: cross-user isolation ─────────────────────────────────────

async def test_update_other_user_task_forbidden(client, client_b):
    task_id = await _create_task(client)
    new_deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    resp = await client_b.put(f"/api/tasks/{task_id}", data={"text": "Hacked", "deadline": new_deadline})
    assert resp.status_code == 403


async def test_delete_other_user_task_forbidden(client, client_b):
    task_id = await _create_task(client)
    resp = await client_b.delete(f"/api/tasks/{task_id}")
    assert resp.status_code == 403


async def test_toggle_other_user_task_forbidden(client, client_b):
    task_id = await _create_task(client)
    resp = await client_b.patch(f"/api/tasks/{task_id}/complete", json={"is_completed": True})
    assert resp.status_code == 403


async def test_get_tasks_user_isolation(client, client_b):
    """User B must not see tasks created by user A."""
    await _create_task(client)
    tasks_b = (await client_b.get("/api/tasks")).json()
    assert len(tasks_b) == 0


# ─── File upload validation ───────────────────────────────────────────────────

async def test_create_task_bad_extension(client, tmp_upload_dir, monkeypatch):
    monkeypatch.setenv("FILE_STORAGE_DIR", tmp_upload_dir)
    deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    fake_file = io.BytesIO(b"MZ\x90\x00")  # EXE magic bytes
    resp = await client.post(
        "/api/tasks",
        data={"text": "bad file", "deadline": deadline},
        files=[("files", ("evil.exe", fake_file, "application/octet-stream"))],
    )
    assert resp.status_code == 400


async def test_create_task_bad_mime(client, tmp_upload_dir, monkeypatch):
    monkeypatch.setenv("FILE_STORAGE_DIR", tmp_upload_dir)
    deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    fake_file = io.BytesIO(b"<script>alert(1)</script>")
    resp = await client.post(
        "/api/tasks",
        data={"text": "bad mime", "deadline": deadline},
        files=[("files", ("file.pdf", fake_file, "text/html"))],
    )
    assert resp.status_code == 400


async def test_create_task_too_many_files(client, tmp_upload_dir, monkeypatch):
    monkeypatch.setenv("FILE_STORAGE_DIR", tmp_upload_dir)
    deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    files = [("files", (f"f{i}.txt", io.BytesIO(b"data"), "text/plain")) for i in range(6)]
    resp = await client.post("/api/tasks", data={"text": "many files", "deadline": deadline}, files=files)
    assert resp.status_code == 400
