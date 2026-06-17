from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router

app = FastAPI(title="QRV Live API", version="0.1.0")

@app.on_event("startup")
async def startup_db_migrations():
    from app.core.database import engine
    from sqlalchemy import text
    import sys
    async with engine.begin() as conn:
        try:
            await conn.execute(text(
                "ALTER TABLE live_flight_bookings ADD COLUMN booking_type VARCHAR(20) NOT NULL DEFAULT 'both'"
            ))
            print("DATABASE MIGRATION: Added 'booking_type' column successfully.", file=sys.stderr)
        except Exception as e:
            print(f"DATABASE MIGRATION ERROR: {e}", file=sys.stderr)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
