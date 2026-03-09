import asyncio
import heapq
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import ReminderModel

logger = logging.getLogger(__name__)


# TODO: multi-worker partitioning — текущий деплой использует один инстанс.
# При масштабировании на несколько воркеров потребуется партиционирование
# (например, по reminder_id % N или через advisory locks в PostgreSQL),
# чтобы избежать дублирования отправок.


class ReminderScheduler:
    def __init__(self) -> None:
        self._heap: list[tuple[datetime, int]] = []
        self._known_ids: set[int] = set()
        self._wake_event = asyncio.Event()
        self._shutdown = False

    async def load_from_db(self, session: AsyncSession) -> int:
        stmt = select(ReminderModel.id, ReminderModel.remind_at).where(
            ReminderModel.status == "pending",
        )
        result = await session.execute(stmt)
        rows = result.all()

        added = 0
        for reminder_id, remind_at in rows:
            if reminder_id not in self._known_ids:
                self._known_ids.add(reminder_id)
                if remind_at.tzinfo is not None:
                    remind_at = remind_at.astimezone(timezone.utc)
                else:
                    remind_at = remind_at.replace(tzinfo=timezone.utc)
                heapq.heappush(self._heap, (remind_at, reminder_id))
                added += 1

        if len(self._heap) > 2 * len(self._known_ids):
            self._compact_heap()

        if added > 0:
            self._wake_event.set()

        logger.info(
            "Loaded %d reminders into scheduler (heap=%d, known=%d)",
            added, len(self._heap), len(self._known_ids),
        )
        return added

    async def wait_for_next(self) -> list[int]:
        while True:
            if self._shutdown:
                return []

            while self._heap and self._heap[0][1] not in self._known_ids:
                heapq.heappop(self._heap)

            if not self._heap:
                self._wake_event.clear()
                await self._wake_event.wait()
                if self._shutdown:
                    return []
                continue

            remind_at, _ = self._heap[0]
            now = datetime.now(timezone.utc)
            delay = (remind_at - now).total_seconds()

            if delay > 0:
                self._wake_event.clear()
                try:
                    await asyncio.wait_for(self._wake_event.wait(), timeout=delay)
                except asyncio.TimeoutError:
                    pass
                if self._shutdown:
                    return []
                continue

            due_ids: list[int] = []
            now = datetime.now(timezone.utc)
            while self._heap:
                remind_at, reminder_id = self._heap[0]
                if remind_at > now:
                    break
                heapq.heappop(self._heap)
                if reminder_id in self._known_ids:
                    due_ids.append(reminder_id)

            if due_ids:
                return due_ids

    def add_one(self, reminder_id: int, remind_at: datetime) -> bool:
        """Add a single reminder from NOTIFY payload. Returns True if added."""
        if reminder_id in self._known_ids:
            return False
        self._known_ids.add(reminder_id)
        if remind_at.tzinfo is not None:
            remind_at = remind_at.astimezone(timezone.utc)
        else:
            remind_at = remind_at.replace(tzinfo=timezone.utc)
        heapq.heappush(self._heap, (remind_at, reminder_id))
        self._wake_event.set()
        logger.info("Added reminder %d via NOTIFY (remind_at=%s)", reminder_id, remind_at)
        return True

    def retry_one(self, reminder_id: int, delay_s: float = 60.0) -> None:
        """Re-schedule a failed reminder for retry after delay_s seconds."""
        from datetime import timedelta
        retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay_s)
        self._known_ids.add(reminder_id)
        heapq.heappush(self._heap, (retry_at, reminder_id))
        self._wake_event.set()
        logger.warning("Scheduled retry for reminder %d in %.0fs", reminder_id, delay_s)

    def mark_processed(self, reminder_id: int) -> None:
        self._known_ids.discard(reminder_id)

    def shutdown(self) -> None:
        """Signal scheduler to stop; unblocks wait_for_next."""
        self._shutdown = True
        self._wake_event.set()

    @property
    def stats(self) -> dict[str, int]:
        return {"heap_size": len(self._heap), "known_ids": len(self._known_ids)}

    def _compact_heap(self) -> None:
        """Remove stale entries from heap and re-heapify."""
        self._heap = [(dt, rid) for dt, rid in self._heap if rid in self._known_ids]
        heapq.heapify(self._heap)
        logger.info("Heap compacted: %d entries", len(self._heap))
