"""Tests for _calculate_remind_times edge cases."""
from datetime import datetime, timedelta, timezone

import pytest

from app.application.task_services import REMIND_HOUR, _calculate_remind_times


def _utc(**kwargs) -> datetime:
    return datetime.now(timezone.utc) + timedelta(**kwargs)


def test_far_deadline_returns_two_reminders():
    """Deadline 3 days away → reminders at day-2 and day-1 at 15:00."""
    deadline = _utc(days=3, hours=2)
    times = _calculate_remind_times(deadline)
    assert len(times) == 2
    for t in times:
        assert t.hour == REMIND_HOUR
        assert t > datetime.now(timezone.utc)


def test_one_and_half_days_returns_one_reminder():
    """Deadline 36h away → only the day-1 reminder is in the future."""
    deadline = _utc(hours=36)
    times = _calculate_remind_times(deadline)
    # day-2 reminder would be 12h ago — already past, so only 1 expected
    assert len(times) == 1
    assert times[0] > datetime.now(timezone.utc)


def test_short_deadline_fallback():
    """Deadline < 24h away → both day-based reminders are past → fallback 5 min."""
    deadline = _utc(hours=20)
    times = _calculate_remind_times(deadline)
    assert len(times) == 1
    now = datetime.now(timezone.utc)
    # Fallback is 5 minutes from now, so should be between 4 and 6 minutes ahead
    delta = (times[0] - now).total_seconds()
    assert 200 < delta < 400, f"Expected ~5 min fallback, got {delta:.0f}s"


def test_past_deadline_fallback():
    """Deadline already past → fallback 5-min reminder."""
    deadline = _utc(hours=-1)
    times = _calculate_remind_times(deadline)
    assert len(times) == 1
    delta = (times[0] - datetime.now(timezone.utc)).total_seconds()
    assert delta > 0


def test_reminders_are_timezone_aware():
    """All returned datetimes must be timezone-aware."""
    deadline = _utc(days=5)
    for t in _calculate_remind_times(deadline):
        assert t.tzinfo is not None
