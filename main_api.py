from contextlib import asynccontextmanager
import logging
from time import perf_counter
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.presentation.api import router
from app.core.config import settings
from app.infrastructure.database import engine

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

LOG_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format=LOG_FORMAT,
)
logger = logging.getLogger("app.api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()

app = FastAPI(
    title="Homework API",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,  # type: ignore[arg-type]
    allow_origins=[settings.ALLOWED_ORIGIN],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "initData"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    if not settings.DEBUG:
        return await call_next(request)

    started_at = perf_counter()
    response = await call_next(request)
    duration_ms = (perf_counter() - started_at) * 1000
    logger.info(
        "Request %s %s -> %s (%.2f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response

app.include_router(router)

if __name__ == "__main__":
    from granian import Granian
    from granian.constants import Interfaces

    Granian(
        "main_api:app",
        address="0.0.0.0",
        port=8000,
        interface=Interfaces.ASGI,
        workers=4,
        backlog=2048
    ).serve()
