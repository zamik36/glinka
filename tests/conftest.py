import tempfile

import pytest
import pytest_asyncio
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.infrastructure.database import Base
from app.infrastructure.models import TaskModel, ReminderModel, AttachmentModel  # noqa: F401

FAKE_USER_ID = 123456789
OTHER_USER_ID = 987654321


@pytest_asyncio.fixture()
async def async_engine():
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture()
async def db_session(async_engine):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture()
async def client(db_session):
    from main_api import app
    from app.infrastructure.database import get_db_session
    from app.presentation.dependencies import get_current_user

    async def _override_db():
        yield db_session

    def _override_user(request: Request) -> int:
        """Read user_id from a test-only header so multiple clients can coexist."""
        uid = request.headers.get("X-Test-User-Id")
        return int(uid) if uid else FAKE_USER_ID

    app.dependency_overrides[get_db_session] = _override_db
    app.dependency_overrides[get_current_user] = _override_user

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"X-Test-User-Id": str(FAKE_USER_ID)},
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def client_b(db_session):
    """HTTP client acting as OTHER_USER_ID.

    Intentionally shares the same db_session as the `client` fixture:
    SQLite in-memory databases do not expose uncommitted data across separate
    connections, so cross-user tests (e.g. user B accessing user A's task)
    require a single shared session.

    Application-layer isolation (WHERE user_id = ?, 403 checks) is fully tested.
    Row-level DB isolation (e.g. PostgreSQL RLS) requires an integration test
    against a real PostgreSQL instance.
    """
    from main_api import app
    from app.infrastructure.database import get_db_session
    from app.presentation.dependencies import get_current_user

    async def _override_db():
        yield db_session

    def _override_user(request: Request) -> int:
        uid = request.headers.get("X-Test-User-Id")
        return int(uid) if uid else OTHER_USER_ID

    app.dependency_overrides[get_db_session] = _override_db
    app.dependency_overrides[get_current_user] = _override_user

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"X-Test-User-Id": str(OTHER_USER_ID)},
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture()
def tmp_upload_dir():
    with tempfile.TemporaryDirectory() as d:
        yield d
