import asyncio
from datetime import datetime, timedelta, timezone

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.worker.scheduler import ReminderScheduler


@pytest.fixture()
def scheduler():
    return ReminderScheduler()


def _make_session(rows: list[tuple[int, datetime]]) -> AsyncMock:
    """Create a mock AsyncSession that returns given (id, remind_at) rows."""
    result = MagicMock()
    result.all.return_value = rows

    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)
    return session


@pytest.mark.asyncio()
async def test_load_from_db_deduplication(scheduler: ReminderScheduler):
    now = datetime.now(timezone.utc)
    rows = [(1, now), (2, now + timedelta(minutes=5))]
    session = _make_session(rows)

    added1 = await scheduler.load_from_db(session)
    assert added1 == 2

    # Second load with same IDs should not add duplicates
    added2 = await scheduler.load_from_db(session)
    assert added2 == 0
    assert len(scheduler._known_ids) == 2


@pytest.mark.asyncio()
async def test_load_from_db_adds_new(scheduler: ReminderScheduler):
    now = datetime.now(timezone.utc)
    session1 = _make_session([(1, now)])
    await scheduler.load_from_db(session1)

    # New reminder appears in DB
    session2 = _make_session([(1, now), (3, now + timedelta(minutes=1))])
    added = await scheduler.load_from_db(session2)
    assert added == 1
    assert 3 in scheduler._known_ids


@pytest.mark.asyncio()
async def test_wait_for_next_returns_overdue(scheduler: ReminderScheduler):
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    session = _make_session([(10, past), (11, past - timedelta(seconds=30))])
    await scheduler.load_from_db(session)

    due_ids = await asyncio.wait_for(scheduler.wait_for_next(), timeout=1.0)
    assert set(due_ids) == {10, 11}


@pytest.mark.asyncio()
async def test_wait_for_next_waits_for_future(scheduler: ReminderScheduler):
    future = datetime.now(timezone.utc) + timedelta(seconds=10)
    session = _make_session([(20, future)])
    await scheduler.load_from_db(session)

    # Should not return within 0.1s since reminder is 10s in the future
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(scheduler.wait_for_next(), timeout=0.1)


@pytest.mark.asyncio()
async def test_wait_for_next_blocks_on_empty(scheduler: ReminderScheduler):
    # Empty scheduler should block
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(scheduler.wait_for_next(), timeout=0.1)


@pytest.mark.asyncio()
async def test_mark_processed(scheduler: ReminderScheduler):
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    session = _make_session([(5, past)])
    await scheduler.load_from_db(session)

    assert 5 in scheduler._known_ids
    scheduler.mark_processed(5)
    assert 5 not in scheduler._known_ids


@pytest.mark.asyncio()
async def test_mark_processed_skips_in_wait(scheduler: ReminderScheduler):
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    session = _make_session([(5, past), (6, past)])
    await scheduler.load_from_db(session)

    # Mark 5 as processed before wait_for_next
    scheduler.mark_processed(5)

    due_ids = await asyncio.wait_for(scheduler.wait_for_next(), timeout=1.0)
    assert due_ids == [6]


@pytest.mark.asyncio()
async def test_shutdown_unblocks_wait_for_next(scheduler: ReminderScheduler):
    """shutdown() should unblock wait_for_next and return []."""
    async def do_shutdown():
        await asyncio.sleep(0.05)
        scheduler.shutdown()

    asyncio.get_event_loop().create_task(do_shutdown())
    result = await asyncio.wait_for(scheduler.wait_for_next(), timeout=1.0)
    assert result == []


@pytest.mark.asyncio()
async def test_shutdown_returns_empty_when_items_present(scheduler: ReminderScheduler):
    """Even with items in heap, shutdown returns []."""
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    session = _make_session([(100, future)])
    await scheduler.load_from_db(session)

    async def do_shutdown():
        await asyncio.sleep(0.05)
        scheduler.shutdown()

    asyncio.get_event_loop().create_task(do_shutdown())
    result = await asyncio.wait_for(scheduler.wait_for_next(), timeout=1.0)
    assert result == []


@pytest.mark.asyncio()
async def test_heap_compaction(scheduler: ReminderScheduler):
    """Heap compacts when stale entries exceed 2x known_ids."""
    now = datetime.now(timezone.utc) - timedelta(minutes=1)
    # Load 5 reminders
    session = _make_session([(i, now + timedelta(seconds=i)) for i in range(1, 6)])
    await scheduler.load_from_db(session)

    # Mark 4 as processed — only 1 remains known
    for i in range(1, 5):
        scheduler.mark_processed(i)

    assert len(scheduler._known_ids) == 1
    # Heap still has 5 entries
    assert len(scheduler._heap) == 5

    # Next load triggers compaction (5 > 2 * 1)
    session2 = _make_session([])
    await scheduler.load_from_db(session2)

    assert len(scheduler._heap) == 1


@pytest.mark.asyncio()
async def test_timezone_normalization(scheduler: ReminderScheduler):
    """Naive datetimes get UTC tzinfo; aware datetimes get converted to UTC."""
    from datetime import timezone as tz

    utc_plus_3 = tz(timedelta(hours=3))
    # 15:00+03:00 == 12:00 UTC
    aware_time = datetime(2025, 1, 1, 15, 0, 0, tzinfo=utc_plus_3)
    naive_time = datetime(2025, 6, 1, 10, 0, 0)

    session = _make_session([(1, aware_time), (2, naive_time)])
    await scheduler.load_from_db(session)

    # Both entries should be in UTC
    for dt, _ in scheduler._heap:
        assert dt.tzinfo is not None
        assert dt.utcoffset() == timedelta(0)


def test_stats_property(scheduler: ReminderScheduler):
    """stats property returns heap and known_ids sizes."""
    stats = scheduler.stats
    assert stats == {"heap_size": 0, "known_ids": 0}


def test_add_one(scheduler: ReminderScheduler):
    """add_one adds a single reminder to heap and known_ids."""
    remind_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    result = scheduler.add_one(42, remind_at)
    assert result is True
    assert 42 in scheduler._known_ids
    assert len(scheduler._heap) == 1
    assert scheduler._heap[0][1] == 42


def test_add_one_deduplication(scheduler: ReminderScheduler):
    """add_one does not add duplicate reminder."""
    remind_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    scheduler.add_one(42, remind_at)
    result = scheduler.add_one(42, remind_at)
    assert result is False
    assert len(scheduler._heap) == 1


@pytest.mark.asyncio()
async def test_add_one_wakes_wait(scheduler: ReminderScheduler):
    """add_one wakes up wait_for_next when a due reminder is added."""
    past = datetime.now(timezone.utc) - timedelta(minutes=1)

    async def add_later():
        await asyncio.sleep(0.05)
        scheduler.add_one(99, past)

    asyncio.get_event_loop().create_task(add_later())
    due_ids = await asyncio.wait_for(scheduler.wait_for_next(), timeout=1.0)
    assert due_ids == [99]
