from typing import Union
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import (
    LiveFlightBooking,
    LiveFlightSchedule,
    LiveGroupPilot,
    Pilot,
)
from app.schemas.booking import BookingComplete, BookingCreate, BookingOut
from app.services.booking_service import (
    cancel_booking,
    complete_booking,
    create_booking,
    get_booking,
    get_bookings,
    mark_no_show,
    take_over_booking,
    dispatch_booking,
    lazy_check_payouts,
)
from app.services.pilot_utils import get_pilot_avatar

router = APIRouter(prefix="/bookings", tags=["bookings"])

def map_booking_to_out(b: LiveFlightBooking) -> BookingOut:
    is_dep_only = b.departure_pilot_id is not None and b.arrival_pilot_id is None
    active_pirep = b.departure_pirep if is_dep_only else b.arrival_pirep
    pirep_accepted = active_pirep.status if active_pirep else 0

    actual_time = 0
    actual_fuel = 0.0
    if b.departure_pirep:
        actual_time += int((b.departure_pirep.flighttime or 0) / 60)
        actual_fuel += float(b.departure_pirep.fuelused or 0)
    if b.arrival_pirep:
        actual_time += int((b.arrival_pirep.flighttime or 0) / 60)
        actual_fuel += float(b.arrival_pirep.fuelused or 0)

    sched_dur = None
    if b.schedule and b.schedule.scheduled_arrival and b.schedule.scheduled_departure:
        sched_dur = int((b.schedule.scheduled_arrival - b.schedule.scheduled_departure).total_seconds() / 60.0)

    actual_arrival = None
    diverted = False
    
    # Determine the actual arrival from the filed PIREP
    if b.arrival_pirep:
        actual_arrival = b.arrival_pirep.arrival
    elif b.departure_pirep and is_dep_only:
        actual_arrival = b.departure_pirep.arrival
        
    scheduled_arrival = (b.schedule.arrival or "OTHH").upper() if b.schedule else "OTHH"
    if actual_arrival and actual_arrival.strip().upper() != scheduled_arrival:
        diverted = True

    return BookingOut(
        id=b.id,
        schedule_id=b.schedule_id,
        departure_pilot_id=b.departure_pilot_id,
        departure_pilot_callsign=b.departure_pilot.callsign if b.departure_pilot else None,
        departure_pilot_avatar=get_pilot_avatar(b.departure_pilot) if b.departure_pilot else None,
        arrival_pilot_id=b.arrival_pilot_id,
        arrival_pilot_callsign=b.arrival_pilot.callsign if b.arrival_pilot else None,
        arrival_pilot_avatar=get_pilot_avatar(b.arrival_pilot) if b.arrival_pilot else None,
        departure_pirep_id=b.departure_pirep_id,
        arrival_pirep_id=b.arrival_pirep_id,
        booked_at=str(b.booked_at),
        dispatched_at=str(b.dispatched_at) if b.dispatched_at else None,
        pax_count=b.pax_count,
        landing_fpm=b.landing_fpm,
        reputation_score=b.reputation_score,
        earnings=b.earnings,
        expenses=b.expenses,
        status=b.status,
        pirep_accepted=pirep_accepted,
        flight_time_minutes=actual_time if actual_time > 0 else None,
        fuel_burned=actual_fuel if actual_fuel > 0 else None,
        scheduled_duration_minutes=sched_dur,
        flight_departure=b.schedule.departure if b.schedule else None,
        flight_arrival=b.schedule.arrival if b.schedule else None,
        flight_scheduled_dep=str(b.schedule.scheduled_departure) if b.schedule else None,
        flight_number=b.schedule.flight_number if b.schedule else None,
        aircraft_registration=b.schedule.aircraft.registration if b.schedule and b.schedule.aircraft else None,
        aircraft_icao=b.schedule.aircraft.aircraft_type.icao if b.schedule and b.schedule.aircraft and b.schedule.aircraft.aircraft_type else None,
        actual_arrival=actual_arrival,
        diverted=diverted,
    )


@router.get("", response_model=list[BookingOut])
async def list_bookings(
    pilot_id: int | None = Query(None),
    schedule_id: int | None = Query(None),
    status: str | None = Query(None),
    group_id: int | None = Query(None),
    schedule_ids: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if pilot_id:
        await lazy_check_payouts(db, pilot_id)

    bookings = await get_bookings(db, pilot_id, schedule_id, status, group_id)

    if schedule_ids:
        ids = [int(x) for x in schedule_ids.split(",") if x.strip()]
        bookings = [b for b in bookings if b.schedule_id in ids]

    return [map_booking_to_out(b) for b in bookings]


@router.post("", response_model=Union[BookingOut, list[BookingOut]])
async def create_booking_route(
    data: BookingCreate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    # Check group membership
    schedule_result = await db.execute(
        select(LiveFlightSchedule)
        .where(LiveFlightSchedule.id == data.schedule_id)
        .options(selectinload(LiveFlightSchedule.aircraft))
    )
    schedule = schedule_result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    member_result = await db.execute(
        select(LiveGroupPilot).where(
            LiveGroupPilot.group_id == schedule.group_id,
            LiveGroupPilot.pilot_id == pilot.id,
            LiveGroupPilot.removed_at.is_(None),
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You must be a member of this group to book flights")

    try:
        # Create bookings atomically (with commit=False)
        bookings = await create_booking(db, data.schedule_id, pilot.id, data.booking_type, commit=False)
        if not bookings:
            raise HTTPException(status_code=400, detail="Schedule not available or already booked")

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    # Need to load relationships for mapping
    # Just refresh or load via get_booking
    loaded_bookings = []
    for b in bookings:
        loaded = await get_booking(db, b.id)
        if loaded:
            loaded_bookings.append(loaded)

    out_list = [map_booking_to_out(b) for b in loaded_bookings]

    return out_list if data.booking_type == "both" else out_list[0]


@router.delete("/{booking_id}")
async def cancel_booking_route(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    booking = await cancel_booking(db, booking_id, pilot.id)
    if not booking:
        raise HTTPException(status_code=400, detail="Booking not found or not cancellable")
    return {"detail": "Booking cancelled"}


@router.post("/{booking_id}/dispatch", response_model=BookingOut)
async def dispatch_booking_route(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    booking = await dispatch_booking(db, booking_id, pilot.id)
    if not booking:
        raise HTTPException(status_code=400, detail="Cannot dispatch flight or not authorized")
    return map_booking_to_out(booking)


@router.post("/{booking_id}/complete", response_model=BookingOut)
async def complete_booking_route(
    booking_id: int,
    data: BookingComplete,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    booking_obj = await get_booking(db, booking_id)
    if not booking_obj:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Authorization check
    if booking_obj.departure_pilot_id != pilot.id and booking_obj.arrival_pilot_id != pilot.id:
        from app.models.live_models import Permission
        perm_result = await db.execute(
            select(Permission).where(
                Permission.userid == pilot.id,
                Permission.name.in_(["admin", "opsmanage"]),
            ).limit(1)
        )
        if perm_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Not authorized to complete this booking")

    try:
        booking = await complete_booking(
            db=db,
            booking_id=booking_id,
            flight_time_minutes=data.flight_time_minutes,
            fuel_burned=data.fuel_burned,
            landing_fpm=data.landing_fpm,
            actual_arrival=data.actual_arrival
        )
        if not booking:
            raise HTTPException(status_code=400, detail="Booking not found or not in booked status")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    # Get updated details
    booking_loaded = await get_booking(db, booking.id)
    return map_booking_to_out(booking_loaded)


@router.post("/{booking_id}/no-show", response_model=BookingOut)
async def no_show_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    booking = await mark_no_show(db, booking_id)
    if not booking:
        raise HTTPException(status_code=400, detail="Booking not found or not in booked status")
    
    booking_loaded = await get_booking(db, booking.id)
    return map_booking_to_out(booking_loaded)


@router.post("/{booking_id}/take-over", response_model=BookingOut)
async def take_over_booking_route(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    booking = await take_over_booking(db, booking_id, pilot.id)
    if not booking:
        raise HTTPException(status_code=400, detail="Booking not available for take-over")
        
    booking_loaded = await get_booking(db, booking.id)
    return map_booking_to_out(booking_loaded)
