import pytest
from fastapi import HTTPException

from app.core.security import validate_telegram_data


def test_invalid_hash_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        validate_telegram_data("user=%7B%22id%22%3A123%7D&hash=invalidhash&auth_date=9999999999")
    assert exc_info.value.status_code == 401


def test_empty_string_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        validate_telegram_data("")
    assert exc_info.value.status_code == 401
