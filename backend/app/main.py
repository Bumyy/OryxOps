from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router

from app.core.config import settings

app = FastAPI(title="QRV Live API", version="0.1.0")



import logging

logger = logging.getLogger("uvicorn")
origins = [origin.strip().strip("'\"").rstrip("/") for origin in settings.cors_origins.split(",") if origin.strip()]
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
