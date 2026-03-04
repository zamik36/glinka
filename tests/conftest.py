import os
import tempfile

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.infrastructure.database import Base
from app.infrastructure.models import TaskModel, ReminderModel, AttachmentModel  # noqa: F401

FAKE_USER_ID = 123456789


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

    app.dependency_overrides[get_db_session] = _override_db
    app.dependency_overrides[get_current_user] = lambda: FAKE_USER_ID

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture()
def tmp_upload_dir():
    with tempfile.TemporaryDirectory() as d:
        yield d
