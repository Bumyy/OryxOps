from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot
from app.models.live_models import Pilot
from app.services.discovery_service import (
    get_pilot_discovery_for_type,
    get_pilot_discovery_summary,
)

router = APIRouter(prefix="/discovery", tags=["discovery"])


@router.get("/pilot/{pilot_id}/summary")
async def pilot_discovery_summary(
    pilot_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await get_pilot_discovery_summary(db, pilot_id)


@router.get("/pilot/{pilot_id}/type/{aircraft_type_id}")
async def pilot_discovery_for_type(
    pilot_id: int,
    aircraft_type_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await get_pilot_discovery_for_type(db, pilot_id, aircraft_type_id)
    return result


@router.get("/me/summary")
async def my_discovery_summary(
    pilot: Pilot = Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    return await get_pilot_discovery_summary(db, pilot.id)


@router.get("/me/type/{aircraft_type_id}")
async def my_discovery_for_type(
    aircraft_type_id: int,
    pilot: Pilot = Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    return await get_pilot_discovery_for_type(db, pilot.id, aircraft_type_id)
