import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings

logger = logging.getLogger("uvicorn")

origins = [origin.strip().strip("'\"") for origin in settings.cors_origins.split(",") if origin.strip()]

_tracker_task: asyncio.Task | None = None


async def _tracking_loop():
    """Background polling loop: sync IF flights every 60 seconds."""
    from app.core.database import async_session
    from app.services.if_tracking_service import tracker, check_completed_flights

    while True:
        try:
            async with async_session() as db:
                await tracker.sync(db)
                await check_completed_flights(db)
        except Exception as exc:
            logger.error(f"IF tracking background sync failed: {exc}")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _tracker_task
    _tracker_task = asyncio.create_task(_tracking_loop())
    logger.info("IF tracking background worker started")
    yield
    if _tracker_task:
        _tracker_task.cancel()
        try:
            await _tracker_task
        except asyncio.CancelledError:
            pass
    logger.info("IF tracking background worker stopped")


app = FastAPI(title="QRV Live API", version="0.1.0", lifespan=lifespan)

logger.info(f"Loaded CORS origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.qatarivirtual\.(com|xyz)|http://localhost:.*|http://127\.0\.0\.1:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "0.1.1",
        "built_at": "2026-07-17T11:05:24Z",
        "description": "Auto-deployment verification test"
    }
