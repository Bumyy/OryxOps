from typing import Union
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import (
    LiveFlightBooking,
    LiveFlightSchedule,
    LiveFlyingGroup,
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
)
from app.services.pilot_utils import get_pilot_avatar

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("", response_model=list[BookingOut])
async def list_bookings(
    pilot_id: int | None = Query(None),
    schedule_id: int | None = Query(None),
    status: str | None = Query(None),
    group_id: int | None = Query(None),
    schedule_ids: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    bookings = await get_bookings(db, pilot_id, schedule_id, status, group_id)

    if schedule_ids:
        ids = [int(x) for x in schedule_ids.split(",") if x.strip()]
        bookings = [b for b in bookings if b.schedule_id in ids]

    return [
        BookingOut(
            id=b.id,
            schedule_id=b.schedule_id,
            pilot_id=b.pilot_id,
            pilot_callsign=b.pilot.callsign if b.pilot else None,
            pilot_avatar=get_pilot_avatar(b.pilot) if b.pilot else None,
            booking_type=b.booking_type,
            token_cost=b.token_cost,
            booked_at=str(b.booked_at),
            status=b.status,
            completed_pirep_id=b.completed_pirep_id,
            taken_over_by=b.taken_over_by,
            taken_over_by_name=b.taken_over_pilot.callsign if b.taken_over_pilot else None,
            taken_over_at=str(b.taken_over_at) if b.taken_over_at else None,
            flight_departure=b.schedule.departure if b.schedule else None,
            flight_arrival=b.schedule.arrival if b.schedule else None,
            flight_scheduled_dep=str(b.schedule.scheduled_departure) if b.schedule else None,
            aircraft_registration=b.schedule.aircraft.registration if b.schedule and b.schedule.aircraft else None,
        )
        for b in bookings
    ]


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

    # Determine token cost: Disabled token requirement (set cost to 0)
    token_cost = 0

    try:
        # Create bookings atomically (with commit=False)
        bookings = await create_booking(db, data.schedule_id, pilot.id, data.booking_type, commit=False)
        if not bookings:
            raise HTTPException(status_code=400, detail="Schedule not available or already booked")

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    out_list = [
        BookingOut(
            id=b.id,
            schedule_id=b.schedule_id,
            pilot_id=b.pilot_id,
            pilot_callsign=pilot.callsign,
            pilot_avatar=get_pilot_avatar(pilot),
            booking_type=b.booking_type,
            token_cost=b.token_cost,
            booked_at=str(b.booked_at),
            status=b.status,
            completed_pirep_id=b.completed_pirep_id,
            taken_over_by=b.taken_over_by,
            taken_over_at=str(b.taken_over_at) if b.taken_over_at else None,
            flight_departure=schedule.departure,
            flight_arrival=schedule.arrival,
            flight_scheduled_dep=str(schedule.scheduled_departure) if schedule.scheduled_departure else None,
            aircraft_registration=schedule.aircraft.registration if schedule.aircraft else None,
        )
        for b in bookings
    ]

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

    if booking_obj.pilot_id != pilot.id:
        from app.models.live_models import Permission
        perm_result = await db.execute(
            select(Permission).where(
                Permission.userid == pilot.id,
                Permission.name.in_(["admin", "opsmanage"]),
            ).limit(1)
        )
        if perm_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Not authorized to complete this booking")

    booking = await complete_booking(db, booking_id, data.pirep_id)
    if not booking:
        raise HTTPException(status_code=400, detail="Booking not found or not in booked status")
    return BookingOut(
        id=booking.id,
        schedule_id=booking.schedule_id,
        pilot_id=booking.pilot_id,
        pilot_callsign=booking.pilot.callsign if booking.pilot else None,
        pilot_avatar=get_pilot_avatar(booking.pilot) if booking.pilot else None,
        booking_type=booking.booking_type,
        token_cost=booking.token_cost,
        booked_at=str(booking.booked_at),
        status=booking.status,
        completed_pirep_id=booking.completed_pirep_id,
    )


@router.post("/{booking_id}/no-show", response_model=BookingOut)
async def no_show_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    booking = await mark_no_show(db, booking_id)
    if not booking:
        raise HTTPException(status_code=400, detail="Booking not found or not in booked status")
    return BookingOut(
        id=booking.id,
        schedule_id=booking.schedule_id,
        pilot_id=booking.pilot_id,
        pilot_callsign=booking.pilot.callsign if booking.pilot else None,
        pilot_avatar=get_pilot_avatar(booking.pilot) if booking.pilot else None,
        booking_type=booking.booking_type,
        token_cost=booking.token_cost,
        booked_at=str(booking.booked_at),
        status=booking.status,
    )


@router.post("/{booking_id}/take-over", response_model=BookingOut)
async def take_over_booking_route(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    booking = await take_over_booking(db, booking_id, pilot.id)
    if not booking:
        raise HTTPException(status_code=400, detail="Booking not available for take-over")
    return BookingOut(
        id=booking.id,
        schedule_id=booking.schedule_id,
        pilot_id=booking.pilot_id,
        pilot_callsign=booking.pilot.callsign if booking.pilot else None,
        pilot_avatar=get_pilot_avatar(booking.pilot) if booking.pilot else None,
        booking_type=booking.booking_type,
        token_cost=booking.token_cost,
        booked_at=str(booking.booked_at),
        status=booking.status,
        taken_over_by=pilot.id,
        taken_over_by_name=pilot.callsign,
        taken_over_at=str(booking.taken_over_at) if booking.taken_over_at else None,
    )
