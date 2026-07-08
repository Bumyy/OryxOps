from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import Pilot
from app.schemas.aircraft import (
    AircraftTypeOut,
    LiveAircraftCreate,
    LiveAircraftDetailOut,
    LiveAircraftHistoryOut,
    LiveAircraftOut,
    LiveAircraftUpdate,
)
from app.services.aircraft_service import (
    create_airframe,
    get_aircraft_types,
    get_airframe,
    get_airframe_group_name,
    get_airframe_history,
    get_all_airframes,
    update_airframe,
)

router = APIRouter(prefix="/aircraft", tags=["aircraft"])


@router.get("/types", response_model=list[AircraftTypeOut])
async def list_aircraft_types(db: AsyncSession = Depends(get_db)):
    return await get_aircraft_types(db)


@router.get("", response_model=list[LiveAircraftOut])
async def list_airframes(
    status: str | None = Query(None),
    group_id: int | None = Query(None),
    airport: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    airframes = await get_all_airframes(db, status, group_id, airport)
    return [
        LiveAircraftOut(
            id=a.id,
            aircraft_type_id=a.aircraft_type_id,
            aircraft_type_name=a.aircraft_type.name if a.aircraft_type else None,
            registration=a.registration,
            if_aircraft_id=a.if_aircraft_id,
            if_organization_aircraft_id=a.if_organization_aircraft_id,
            current_airport=a.current_airport,
            current_parking_id=a.current_parking_id,
            status=a.status,
            current_pilot_id=a.current_pilot_id,
            current_pilot_name=a.current_pilot.callsign if a.current_pilot else None,
            last_pilot_id=a.last_pilot_id,
            last_pilot_name=a.last_pilot.callsign if a.last_pilot else None,
            last_airport=a.last_airport,
            last_flight_at=str(a.last_flight_at) if a.last_flight_at else None,
            total_flight_hours=a.total_flight_hours,
            total_flights=a.total_flights,
            delivered_at=str(a.delivered_at) if a.delivered_at else None,
            home_base=a.home_base,
        )
        for a in airframes
    ]


@router.get("/{airframe_id}", response_model=LiveAircraftDetailOut)
async def get_airframe_detail(airframe_id: int, db: AsyncSession = Depends(get_db)):
    airframe = await get_airframe(db, airframe_id)
    if not airframe:
        raise HTTPException(status_code=404, detail="Airframe not found")

    group_name = await get_airframe_group_name(db, airframe_id)

    return LiveAircraftDetailOut(
        id=airframe.id,
        aircraft_type_id=airframe.aircraft_type_id,
        aircraft_type_name=airframe.aircraft_type.name if airframe.aircraft_type else None,
        registration=airframe.registration,
        if_aircraft_id=airframe.if_aircraft_id,
        current_airport=airframe.current_airport,
        current_parking_id=airframe.current_parking_id,
        current_parking_name=airframe.current_parking.name if airframe.current_parking else None,
        status=airframe.status,
        current_pilot_id=airframe.current_pilot_id,
        current_pilot_name=airframe.current_pilot.callsign if airframe.current_pilot else None,
        last_pilot_id=airframe.last_pilot_id,
        last_pilot_name=airframe.last_pilot.callsign if airframe.last_pilot else None,
        last_airport=airframe.last_airport,
        last_flight_at=str(airframe.last_flight_at) if airframe.last_flight_at else None,
        total_flight_hours=airframe.total_flight_hours,
        total_flights=airframe.total_flights,
        delivered_at=str(airframe.delivered_at) if airframe.delivered_at else None,
        home_base=airframe.home_base,
        group_name=group_name,
    )


@router.get("/{airframe_id}/history", response_model=list[LiveAircraftHistoryOut])
async def get_airframe_history_route(airframe_id: int, db: AsyncSession = Depends(get_db)):
    pireps = await get_airframe_history(db, airframe_id)
    return [
        LiveAircraftHistoryOut(
            id=p.id,
            flightnum=p.flightnum,
            departure=p.departure,
            arrival=p.arrival,
            flighttime=p.flighttime,
            pilot_name=p.pilot.callsign if p.pilot else None,
            date=str(p.date) if p.date else "",
            fuelused=p.fuelused,
        )
        for p in pireps
    ]


@router.post("", response_model=LiveAircraftOut)
async def create_airframe_route(
    data: LiveAircraftCreate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    airframe = await create_airframe(db, data.model_dump())
    return LiveAircraftOut(
        id=airframe.id,
        aircraft_type_id=airframe.aircraft_type_id,
        registration=airframe.registration,
        current_airport=airframe.current_airport,
        status=airframe.status,
        total_flight_hours=airframe.total_flight_hours,
        total_flights=airframe.total_flights,
        home_base=airframe.home_base,
    )


@router.patch("/{airframe_id}", response_model=LiveAircraftOut)
async def update_airframe_route(
    airframe_id: int,
    data: LiveAircraftUpdate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    airframe = await update_airframe(db, airframe_id, data.model_dump(exclude_none=True))
    if not airframe:
        raise HTTPException(status_code=404, detail="Airframe not found")
    return LiveAircraftOut(
        id=airframe.id,
        aircraft_type_id=airframe.aircraft_type_id,
        aircraft_type_name=airframe.aircraft_type.name if airframe.aircraft_type else None,
        registration=airframe.registration,
        if_aircraft_id=airframe.if_aircraft_id,
        current_airport=airframe.current_airport,
        current_parking_id=airframe.current_parking_id,
        status=airframe.status,
        current_pilot_id=airframe.current_pilot_id,
        total_flight_hours=airframe.total_flight_hours,
        total_flights=airframe.total_flights,
        home_base=airframe.home_base,
    )
