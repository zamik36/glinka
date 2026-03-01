import hashlib
import hmac
import urllib.parse
import json
from fastapi import HTTPException
from app.core.config import settings

def validate_telegram_data(init_data: str) -> dict:
    """Проверяет подпись Telegram и возвращает данные пользователя"""
    try:
        parsed_data = dict(urllib.parse.parse_qsl(init_data))
        hash_val = parsed_data.pop('hash')
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))
        secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if calculated_hash != hash_val:
            raise ValueError("Invalid hash")

        return json.loads(parsed_data['user'])
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid Telegram initData")