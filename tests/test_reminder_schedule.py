"""Tests for _calculate_remind_times edge cases.

All time-sensitive tests pin datetime.now to 2026-03-09T20:00 UTC so that
'today at 15:00' is always in the past and results do not depend on the
wall-clock hour at which the test suite runs.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.application.task_services import REMIND_HOUR, _calculate_remind_times

# Fixed "now": 20:00 UTC → 15:00 same day is guaranteed past.
_FIXED_NOW = datetime(2026, 3, 9, 20, 0, 0, tzinfo=timezone.utc)


def _fixed(**kwargs) -> datetime:
    return _FIXED_NOW + timedelta(**kwargs)


def _mock_now():
    """Patch datetime.now inside task_services to return _FIXED_NOW."""
    return patch("app.application.task_services.datetime")


def _calc(deadline: datetime) -> list[datetime]:
    with _mock_now() as mock_dt:
        mock_dt.now.return_value = _FIXED_NOW
        return _calculate_remind_times(deadline)


def test_far_deadline_returns_two_reminders():
    """Deadline 3 days + 2h away → both day-2 and day-1 reminders are in the future."""
    times = _calc(_fixed(days=3, hours=2))
    assert len(times) == 2
    for t in times:
        assert t.hour == REMIND_HOUR
        assert t > _FIXED_NOW


def test_one_and_half_days_returns_one_reminder():
    """Deadline 36h away → day-2 remind (15:00 today) is past; only day-1 returned.

    With now=20:00 UTC:
      deadline     = 2026-03-11 08:00
      day-2 remind = 2026-03-09 15:00  → past  (15:00 < 20:00)
      day-1 remind = 2026-03-10 15:00  → future
    """
    times = _calc(_fixed(hours=36))
    assert len(times) == 1
    assert times[0] > _FIXED_NOW


def test_short_deadline_fallback():
    """Deadline 20h away → both day-based reminders past → fallback 5 min.

    With now=20:00 UTC:
      deadline     = 2026-03-10 16:00
      day-2 remind = 2026-03-08 15:00  → past
      day-1 remind = 2026-03-09 15:00  → past  (15:00 < 20:00)
    """
    times = _calc(_fixed(hours=20))
    assert len(times) == 1
    delta = (times[0] - _FIXED_NOW).total_seconds()
    assert 200 < delta < 400, f"Expected ~5 min fallback, got {delta:.0f}s"


def test_past_deadline_fallback():
    """Deadline already past → fallback 5-min reminder."""
    times = _calc(_fixed(hours=-1))
    assert len(times) == 1
    delta = (times[0] - _FIXED_NOW).total_seconds()
    assert delta > 0


def test_reminders_are_timezone_aware():
    """All returned datetimes must be timezone-aware."""
    for t in _calc(_fixed(days=5)):
        assert t.tzinfo is not None
