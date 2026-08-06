from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import LiveFlightBooking, Pirep


async def calculate_pilot_booking_hours(db: AsyncSession, pilot_id: int) -> dict:
    """
    Calculates total flight hours for a pilot from the booking table broken down into 3 types:
    1. full_book_hours: Pilot flew both Departure & Arrival legs (or solo flight)
    2. only_dep_hours: Pilot flew only the Departure leg
    3. only_arri_hours: Pilot flew only the Arrival leg
    """
    stmt = (
        select(LiveFlightBooking)
        .options(
            selectinload(LiveFlightBooking.departure_pirep),
            selectinload(LiveFlightBooking.arrival_pirep),
            selectinload(LiveFlightBooking.schedule),
        )
        .where(
            and_(
                LiveFlightBooking.status == "completed",
                or_(
                    LiveFlightBooking.departure_pilot_id == pilot_id,
                    LiveFlightBooking.arrival_pilot_id == pilot_id,
                ),
            )
        )
    )

    result = await db.execute(stmt)
    bookings = result.scalars().all()

    full_book_seconds = 0
    only_dep_seconds = 0
    only_arri_seconds = 0

    full_book_count = 0
    only_dep_count = 0
    only_arri_count = 0

    for b in bookings:
        is_dep = b.departure_pilot_id == pilot_id
        is_arr = b.arrival_pilot_id == pilot_id

        # Calculate flight duration from PIREPs or schedule
        flight_seconds = 0
        if is_dep and b.departure_pirep and b.departure_pirep.flighttime:
            flight_seconds += b.departure_pirep.flighttime
        elif is_arr and b.arrival_pirep and b.arrival_pirep.flighttime:
            flight_seconds += b.arrival_pirep.flighttime
        elif b.schedule and b.schedule.scheduled_departure and b.schedule.scheduled_arrival:
            flight_seconds = int((b.schedule.scheduled_arrival - b.schedule.scheduled_departure).total_seconds())

        if is_dep and (is_arr or not b.arrival_pilot_id):
            # Full Book / Solo
            full_book_seconds += flight_seconds
            full_book_count += 1
        elif is_dep and not is_arr:
            # Departure Leg Only
            only_dep_seconds += flight_seconds
            only_dep_count += 1
        elif is_arr and not is_dep:
            # Arrival Leg Only
            only_arri_seconds += flight_seconds
            only_arri_count += 1

    full_book_hours = round(full_book_seconds / 3600.0, 1)
    only_dep_hours = round(only_dep_seconds / 3600.0, 1)
    only_arri_hours = round(only_arri_seconds / 3600.0, 1)
    total_hours = round((full_book_seconds + only_dep_seconds + only_arri_seconds) / 3600.0, 1)

    return {
        "pilot_id": pilot_id,
        "full_book_hours": full_book_hours,
        "only_dep_hours": only_dep_hours,
        "only_arri_hours": only_arri_hours,
        "total_hours": total_hours,
        "full_book_count": full_book_count,
        "only_dep_count": only_dep_count,
        "only_arri_count": only_arri_count,
        "total_bookings_count": full_book_count + only_dep_count + only_arri_count,
    }


async def get_pilot_booking_total_seconds(db: AsyncSession, pilot_id: int) -> int:
    """
    Calculates total PIREP seconds for a pilot ONLY from completed entries in live_flight_bookings.
    """
    stmt = (
        select(LiveFlightBooking)
        .options(
            selectinload(LiveFlightBooking.departure_pirep),
            selectinload(LiveFlightBooking.arrival_pirep),
            selectinload(LiveFlightBooking.schedule),
        )
        .where(
            and_(
                LiveFlightBooking.status == "completed",
                or_(
                    LiveFlightBooking.departure_pilot_id == pilot_id,
                    LiveFlightBooking.arrival_pilot_id == pilot_id,
                ),
            )
        )
    )
    result = await db.execute(stmt)
    bookings = result.scalars().all()

    total_seconds = 0
    for b in bookings:
        is_dep = b.departure_pilot_id == pilot_id
        is_arr = b.arrival_pilot_id == pilot_id

        if is_dep and b.departure_pirep and b.departure_pirep.flighttime:
            total_seconds += b.departure_pirep.flighttime
        elif is_arr and b.arrival_pirep and b.arrival_pirep.flighttime:
            total_seconds += b.arrival_pirep.flighttime
        elif b.schedule and b.schedule.scheduled_departure and b.schedule.scheduled_arrival:
            total_seconds += int((b.schedule.scheduled_arrival - b.schedule.scheduled_departure).total_seconds())

    return total_seconds
