from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot
from app.models.live_models import Pilot
from app.schemas.booking import BookingComplete, BookingCreate, BookingOut
from app.services.booking_service import (
    cancel_booking,
    complete_booking,
    create_booking,
    get_bookings,
    mark_no_show,
    take_over_booking,
)
from app.services.token_service import spend_tokens

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("", response_model=list[BookingOut])
async def list_bookings(
    pilot_id: int | None = Query(None),
    schedule_id: int | None = Query(None),
    status: str | None = Query(None),
    group_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    bookings = await get_bookings(db, pilot_id, schedule_id, status, group_id)
    return [
        BookingOut(
            id=b.id,
            schedule_id=b.schedule_id,
            pilot_id=b.pilot_id,
            pilot_callsign=b.pilot.callsign if b.pilot else None,
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


@router.post("", response_model=BookingOut)
async def create_booking_route(
    data: BookingCreate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    booking = await create_booking(db, data.schedule_id, pilot.id)
    if not booking:
        raise HTTPException(status_code=400, detail="Schedule not available or already booked")

    wallet = await spend_tokens(
        db, pilot.id, booking.token_cost,
        transaction_type="booking_spend",
        reference_id=booking.id,
        description=f"Booking for schedule #{data.schedule_id}",
    )
    if not wallet:
        raise HTTPException(status_code=400, detail="Insufficient tokens")

    return BookingOut(
        id=booking.id,
        schedule_id=booking.schedule_id,
        pilot_id=booking.pilot_id,
        pilot_callsign=pilot.callsign,
        token_cost=booking.token_cost,
        booked_at=str(booking.booked_at),
        status=booking.status,
        completed_pirep_id=booking.completed_pirep_id,
        taken_over_by=booking.taken_over_by,
        taken_over_at=str(booking.taken_over_at) if booking.taken_over_at else None,
    )


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
    booking = await complete_booking(db, booking_id, data.pirep_id)
    if not booking:
        raise HTTPException(status_code=400, detail="Booking not found or not in booked status")
    return BookingOut(
        id=booking.id,
        schedule_id=booking.schedule_id,
        pilot_id=booking.pilot_id,
        pilot_callsign=booking.pilot.callsign if booking.pilot else None,
        token_cost=booking.token_cost,
        booked_at=str(booking.booked_at),
        status=booking.status,
        completed_pirep_id=booking.completed_pirep_id,
    )


@router.post("/{booking_id}/no-show", response_model=BookingOut)
async def no_show_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    booking = await mark_no_show(db, booking_id)
    if not booking:
        raise HTTPException(status_code=400, detail="Booking not found or not in booked status")
    return BookingOut(
        id=booking.id,
        schedule_id=booking.schedule_id,
        pilot_id=booking.pilot_id,
        pilot_callsign=booking.pilot.callsign if booking.pilot else None,
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
        token_cost=booking.token_cost,
        booked_at=str(booking.booked_at),
        status=booking.status,
        taken_over_by=pilot.id,
        taken_over_by_name=pilot.callsign,
        taken_over_at=str(booking.taken_over_at) if booking.taken_over_at else None,
    )
