from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import Pilot
from app.services.if_tracking_service import (
    tracker,
    check_completed_flights,
)

router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.get("/status")
async def tracking_status(
    pilot: Pilot = Depends(get_current_pilot),
):
    return tracker.status


@router.post("/sync")
async def trigger_sync(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    result = await tracker.sync(db)
    await check_completed_flights(db)
    return result
