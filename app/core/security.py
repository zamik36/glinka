import hashlib
import hmac
import time
import urllib.parse
import json
import logging
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)

def validate_telegram_data(init_data: str) -> dict:
    """Проверяет подпись Telegram и возвращает данные пользователя"""
    try:
        parsed_data = dict(urllib.parse.parse_qsl(init_data))
        hash_val = parsed_data.pop('hash')
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))
        secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(calculated_hash, hash_val):
            raise ValueError("Invalid hash")

        auth_date = int(parsed_data.get('auth_date', 0))
        if time.time() - auth_date > settings.INIT_DATA_TTL:
            raise ValueError("initData expired")

        user_json = parsed_data.get('user')
        if not user_json:
            raise ValueError("Missing 'user' field in initData")
        return json.loads(user_json)
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.warning("initData validation failed: %s: %s", type(e).__name__, e)
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid Telegram initData")
    except Exception:
        logger.exception("Unexpected error during initData validation")
        raise HTTPException(status_code=500, detail="Internal server error")
