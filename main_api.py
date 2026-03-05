import os
from contextlib import asynccontextmanager
import logging
from time import perf_counter
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from app.presentation.api import router
from app.core.config import settings
from app.core.logging_config import configure_logging
from app.infrastructure.database import engine, AsyncSessionLocal

# Prometheus multiprocess mode — must be set before prometheus_client is imported
_prom_dir = os.environ.get("PROMETHEUS_MULTIPROC_DIR", "/tmp/prom_mp")
os.makedirs(_prom_dir, exist_ok=True)
os.environ.setdefault("PROMETHEUS_MULTIPROC_DIR", _prom_dir)

from prometheus_fastapi_instrumentator import Instrumentator  # noqa: E402

configure_logging(settings.DEBUG)
logger = logging.getLogger("app.api")

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


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

Instrumentator(
    should_group_status_codes=True,
    excluded_handlers=["/metrics", "/health"],
).instrument(app).expose(app, endpoint="/metrics")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

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


@app.get("/health", include_in_schema=False)
async def health():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return JSONResponse({"status": "ok", "service": "api"})
    except Exception as e:
        logger.error("Health check failed: %s", e)
        return JSONResponse({"status": "error", "detail": str(e)}, status_code=503)


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
