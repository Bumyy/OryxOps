from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import LiveAircraft, LiveFlightBooking, LiveFlightSchedule, LiveTokens


async def get_bookings(
    db: AsyncSession,
    pilot_id: int | None = None,
    schedule_id: int | None = None,
    status: str | None = None,
    group_id: int | None = None,
) -> list[LiveFlightBooking]:
    query = select(LiveFlightBooking).options(
        selectinload(LiveFlightBooking.schedule)
        .selectinload(LiveFlightSchedule.aircraft),
        selectinload(LiveFlightBooking.pilot),
    )

    if pilot_id:
        query = query.where(LiveFlightBooking.pilot_id == pilot_id)
    if schedule_id:
        query = query.where(LiveFlightBooking.schedule_id == schedule_id)
    if status:
        query = query.where(LiveFlightBooking.status == status)
    if group_id:
        query = query.join(LiveFlightSchedule).where(
            LiveFlightSchedule.group_id == group_id
        )

    query = query.order_by(LiveFlightBooking.booked_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_booking(db: AsyncSession, booking_id: int) -> LiveFlightBooking | None:
    result = await db.execute(
        select(LiveFlightBooking)
        .where(LiveFlightBooking.id == booking_id)
        .options(
            selectinload(LiveFlightBooking.schedule)
            .selectinload(LiveFlightSchedule.aircraft),
            selectinload(LiveFlightBooking.pilot),
            selectinload(LiveFlightBooking.taken_over_pilot),
        )
    )
    return result.scalar_one_or_none()


async def create_booking(
    db: AsyncSession, schedule_id: int, pilot_id: int, booking_type: str = "both"
) -> LiveFlightBooking | None:
    schedule_result = await db.execute(
        select(LiveFlightSchedule).where(LiveFlightSchedule.id == schedule_id)
    )
    schedule = schedule_result.scalar_one_or_none()
    if not schedule or schedule.status != "approved":
        return None

    existing_result = await db.execute(
        select(LiveFlightBooking).where(
            LiveFlightBooking.schedule_id == schedule_id,
            LiveFlightBooking.status.in_(["booked", "completed"]),
            LiveFlightBooking.booking_type == booking_type,
        )
    )
    if existing_result.scalar_one_or_none():
        return None

    booking = LiveFlightBooking(
        schedule_id=schedule_id,
        pilot_id=pilot_id,
        token_cost=1,
        status="booked",
        booking_type=booking_type,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


async def cancel_booking(db: AsyncSession, booking_id: int, pilot_id: int) -> LiveFlightBooking | None:
    booking = await get_booking(db, booking_id)
    if not booking or booking.pilot_id != pilot_id or booking.status != "booked":
        return None
    booking.status = "cancelled"
    await db.commit()
    await db.refresh(booking)
    return booking


async def complete_booking(
    db: AsyncSession, booking_id: int, pirep_id: int
) -> LiveFlightBooking | None:
    booking = await get_booking(db, booking_id)
    if not booking or booking.status != "booked":
        return None
    booking.status = "completed"
    booking.completed_pirep_id = pirep_id
    await db.commit()
    await db.refresh(booking)
    return booking


async def mark_no_show(db: AsyncSession, booking_id: int) -> LiveFlightBooking | None:
    booking = await get_booking(db, booking_id)
    if not booking or booking.status != "booked":
        return None
    booking.status = "no_show"
    await db.commit()
    await db.refresh(booking)
    return booking


async def take_over_booking(
    db: AsyncSession, booking_id: int, new_pilot_id: int
) -> LiveFlightBooking | None:
    booking = await get_booking(db, booking_id)
    if not booking or booking.status not in ["no_show", "cancelled"]:
        return None
    booking.taken_over_by = new_pilot_id
    booking.taken_over_at = datetime.utcnow()
    booking.status = "reassigned"
    await db.commit()
    await db.refresh(booking)
    return booking
