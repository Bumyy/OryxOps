from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.live_models import Aircraft, Route, RouteAircraft

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("/available")
async def get_available_routes(
    aircraft_type_id: int = Query(...),
    departure: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Return QR mainline routes for a given aircraft type, optionally filtered by departure ICAO."""
    conditions = [
        RouteAircraft.aircraftid == aircraft_type_id,
        or_(
            Route.fltnum.like("%QR%"),
            Route.dep == "OTHH",
            Route.arr == "OTHH",
        ),
    ]
    if departure:
        conditions.append(Route.dep == departure)

    result = await db.execute(
        select(Route)
        .join(RouteAircraft, RouteAircraft.routeid == Route.id)
        .where(*conditions)
        .order_by(Route.dep, Route.arr)
    )
    routes = result.scalars().all()
    return [
        {
            "id": r.id,
            "fltnum": r.fltnum,
            "dep": r.dep,
            "arr": r.arr,
            "duration": r.duration,
            "notes": r.notes,
        }
        for r in routes
    ]


@router.get("/types")
async def get_aircraft_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Aircraft))
    aircraft = result.scalars().all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "icao": a.icao,
            "liveryname": a.liveryname,
        }
        for a in aircraft
    ]
