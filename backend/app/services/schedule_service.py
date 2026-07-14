from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import (
    LiveAircraft,
    LiveFlightBooking,
    LiveFlightSchedule,
    LiveGroupAircraft,
    LiveScheduleWave,
    Route,
)


async def get_schedules(
    db: AsyncSession,
    group_id: int | None = None,
    week_start: str | None = None,
    status: str | None = None,
) -> list[LiveFlightSchedule]:
    query = select(LiveFlightSchedule).options(
        selectinload(LiveFlightSchedule.aircraft),
        selectinload(LiveFlightSchedule.wave),
        selectinload(LiveFlightSchedule.creator),
    )

    if group_id:
        query = query.where(LiveFlightSchedule.group_id == group_id)
    if week_start:
        query = query.where(LiveFlightSchedule.week_start == week_start)
    if status:
        query = query.where(LiveFlightSchedule.status == status)

    query = query.order_by(LiveFlightSchedule.scheduled_departure)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_schedule(db: AsyncSession, schedule_id: int) -> LiveFlightSchedule | None:
    result = await db.execute(
        select(LiveFlightSchedule)
        .where(LiveFlightSchedule.id == schedule_id)
        .options(
            selectinload(LiveFlightSchedule.aircraft),
            selectinload(LiveFlightSchedule.wave),
            selectinload(LiveFlightSchedule.creator),
            selectinload(LiveFlightSchedule.approver),
            selectinload(LiveFlightSchedule.bookings),
        )
    )
    return result.scalar_one_or_none()


async def create_schedule(db: AsyncSession, data: dict) -> LiveFlightSchedule:
    schedule = LiveFlightSchedule(**data)
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


async def update_schedule(
    db: AsyncSession, schedule_id: int, data: dict
) -> LiveFlightSchedule | None:
    result = await db.execute(
        select(LiveFlightSchedule).where(LiveFlightSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(schedule, key, value)
    await db.commit()
    await db.refresh(schedule)
    return schedule


async def delete_schedule(db: AsyncSession, schedule_id: int) -> bool:
    result = await db.execute(
        select(LiveFlightSchedule).where(LiveFlightSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        return False
    schedule.status = "cancelled"
    await db.commit()
    return True


async def update_schedule_status(
    db: AsyncSession, schedule_id: int, status: str, approved_by: int | None = None
) -> LiveFlightSchedule | None:
    schedule = await get_schedule(db, schedule_id)
    if not schedule:
        return None
    schedule.status = status
    if approved_by:
        schedule.approved_by = approved_by
    await db.commit()
    await db.refresh(schedule)
    return schedule


async def bulk_approve_schedules(
    db: AsyncSession, group_id: int, week_start: str, approved_by: int
) -> int:
    result = await db.execute(
        select(LiveFlightSchedule).where(
            LiveFlightSchedule.group_id == group_id,
            LiveFlightSchedule.week_start == week_start,
            LiveFlightSchedule.status == "proposed",
        )
    )
    schedules = list(result.scalars().all())
    count = 0
    for schedule in schedules:
        schedule.status = "approved"
        schedule.approved_by = approved_by
        count += 1
    await db.commit()
    return count


async def get_waves(
    db: AsyncSession, group_id: int | None = None, week_start: str | None = None
) -> list[LiveScheduleWave]:
    query = select(LiveScheduleWave)
    if group_id:
        query = query.where(LiveScheduleWave.group_id == group_id)
    if week_start:
        query = query.where(LiveScheduleWave.week_start == week_start)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_wave(db: AsyncSession, data: dict) -> LiveScheduleWave:
    wave = LiveScheduleWave(**data)
    db.add(wave)
    await db.commit()
    await db.refresh(wave)
    return wave


async def delete_wave(db: AsyncSession, wave_id: int) -> bool:
    result = await db.execute(
        select(LiveScheduleWave).where(LiveScheduleWave.id == wave_id)
    )
    wave = result.scalar_one_or_none()
    if not wave:
        return False
    await db.delete(wave)
    await db.commit()
    return True


async def get_available_aircraft_for_schedule(
    db: AsyncSession, group_id: int
) -> list[LiveAircraft]:
    result = await db.execute(
        select(LiveAircraft)
        .join(LiveGroupAircraft, LiveGroupAircraft.aircraft_id == LiveAircraft.id)
        .where(
            LiveGroupAircraft.group_id == group_id,
            LiveGroupAircraft.removed_at.is_(None),
            LiveAircraft.status.in_(["parked", "in_hangar"]),
        )
        .options(selectinload(LiveAircraft.aircraft_type))
    )
    return list(result.scalars().all())


async def get_schedule_booking_count(db: AsyncSession, schedule_id: int) -> int:
    from sqlalchemy import func

    result = await db.execute(
        select(func.count(LiveFlightBooking.id)).where(
            LiveFlightBooking.schedule_id == schedule_id,
            LiveFlightBooking.status.in_(["booked", "completed"]),
        )
    )
    return result.scalar() or 0


async def generate_auto_schedules(
    db: AsyncSession,
    group_id: int,
    aircraft_id: int,
    num_roundtrips: int,
    haul_preference: str,
    start_time_str: str,
    creator_id: int,
    min_hours: int | None = 0,
    max_hours: int | None = 0,
) -> int:
    import random
    from app.models.live_models import RouteAircraft, Route

    # 1. Fetch specified aircraft
    aircraft_result = await db.execute(
        select(LiveAircraft)
        .where(LiveAircraft.id == aircraft_id)
        .options(selectinload(LiveAircraft.aircraft_type))
    )
    ac = aircraft_result.scalar_one_or_none()
    if not ac:
        raise ValueError("Selected aircraft not found.")

    # 2. Parse start_time string to datetime object
    try:
        start_time_str_parsed = start_time_str.replace("Z", "").replace(" ", "T")
        if len(start_time_str_parsed) == 16:  # "YYYY-MM-DDTHH:MM"
            start_time = datetime.strptime(start_time_str_parsed, "%Y-%m-%dT%H:%M")
        else:
            start_time = datetime.fromisoformat(start_time_str_parsed)
    except Exception:
        raise ValueError("Invalid start_time format. Must be a valid ISO datetime (e.g. YYYY-MM-DDTHH:MM).")

    # 3. Calculate weeks to check based on start date and spacing
    weeks_to_check = set()
    for idx in range(num_roundtrips):
        trip_date = (start_time + timedelta(days=idx * 2)).date()
        trip_monday = trip_date - timedelta(days=trip_date.weekday())
        weeks_to_check.add(trip_monday)

    # 4. Check for existing schedules in these weeks for this aircraft
    existing_result = await db.execute(
        select(LiveFlightSchedule)
        .where(
            LiveFlightSchedule.aircraft_id == aircraft_id,
            LiveFlightSchedule.week_start.in_(list(weeks_to_check)),
            LiveFlightSchedule.status != "cancelled"
        )
    )
    existing_schedules = list(existing_result.scalars().all())
    if existing_schedules:
        unique_weeks = sorted(list({str(s.week_start) for s in existing_schedules}))
        raise ValueError(
            f"Aircraft {ac.registration} already has flight leg(s) "
            f"scheduled for the week(s) of {', '.join(unique_weeks)}. Please clear them first."
        )

    # 5. Find candidate routes for this aircraft type departing from/arriving at OTHH
    ac_type_id = ac.aircraft_type_id
    outbound_result = await db.execute(
        select(Route)
        .join(RouteAircraft, RouteAircraft.routeid == Route.id)
        .where(
            RouteAircraft.aircraftid == ac_type_id,
            Route.dep == "OTHH"
        )
    )
    outbound_routes = list(outbound_result.scalars().all())
    
    inbound_result = await db.execute(
        select(Route)
        .join(RouteAircraft, RouteAircraft.routeid == Route.id)
        .where(
            RouteAircraft.aircraftid == ac_type_id,
            Route.arr == "OTHH"
        )
    )
    inbound_routes = list(inbound_result.scalars().all())
    
    # Create round-trip pairs (matching outbound.arr == inbound.dep)
    route_pairs = []
    for out_r in outbound_routes:
        matches = [in_r for in_r in inbound_routes if in_r.dep == out_r.arr]
        if matches:
            route_pairs.append((out_r, matches[0]))
    
    if not route_pairs:
        raise ValueError(f"No certified round-trip routes found from OTHH for aircraft type {ac.aircraft_type.name if ac.aircraft_type else 'unknown'}.")

    # 6. Apply custom flight duration filters
    if min_hours is not None and min_hours > 0:
        route_pairs = [p for p in route_pairs if p[0].duration >= min_hours * 3600]
    if max_hours is not None and max_hours > 0:
        route_pairs = [p for p in route_pairs if p[0].duration <= max_hours * 3600]

    if not route_pairs:
        raise ValueError(
            f"No round-trip routes found for aircraft type {ac.aircraft_type.name if ac.aircraft_type else 'unknown'} "
            f"matching the custom duration constraint (Min: {min_hours or 0}h, Max: {max_hours or 0}h)."
        )
        
    # 6. Filter route pairs based on haul preference (threshold: 3 hours = 10800 seconds)
    short_pairs = [p for p in route_pairs if p[0].duration <= 10800]
    long_pairs = [p for p in route_pairs if p[0].duration > 10800]
    
    selected_pairs = []
    if haul_preference == "short":
        pool = short_pairs if short_pairs else route_pairs
        selected_pairs = [random.choice(pool) for _ in range(num_roundtrips)] if pool else []
    elif haul_preference == "long":
        pool = long_pairs if long_pairs else route_pairs
        selected_pairs = [random.choice(pool) for _ in range(num_roundtrips)] if pool else []
    else:  # mixed
        half = num_roundtrips // 2
        remainder = num_roundtrips - half
        
        selected_short = []
        selected_long = []
        
        if short_pairs:
            selected_short = [random.choice(short_pairs) for _ in range(remainder)]
        if long_pairs:
            selected_long = [random.choice(long_pairs) for _ in range(half)]
            
        if not selected_short and selected_long:
            selected_short = [random.choice(long_pairs) for _ in range(remainder)]
        if not selected_long and selected_short:
            selected_long = [random.choice(short_pairs) for _ in range(half)]
            
        selected_pairs = selected_short + selected_long
        if not selected_pairs:
            selected_pairs = [random.choice(route_pairs) for _ in range(num_roundtrips)]
            
    # 7. Generate schedule records spaced 2 days apart starting from start_time
    total_created = 0
    for idx in range(num_roundtrips):
        if idx >= len(selected_pairs):
            break
            
        outbound, inbound = selected_pairs[idx]
        
        trip_start_time = start_time + timedelta(days=idx * 2)
        outbound_dep_time = trip_start_time
        outbound_arr_time = outbound_dep_time + timedelta(seconds=outbound.duration)
        
        # Calculate correct week_start for this specific trip
        trip_date = trip_start_time.date()
        trip_week_start = trip_date - timedelta(days=trip_date.weekday())
        
        # Ground time: 60 minutes
        ground_time = 60
        inbound_dep_time = outbound_arr_time + timedelta(minutes=ground_time)
        inbound_arr_time = inbound_dep_time + timedelta(seconds=inbound.duration)
        
        # Create outbound flight leg
        outbound_leg = LiveFlightSchedule(
            group_id=group_id,
            aircraft_id=ac.id,
            route_id=outbound.id,
            departure=outbound.dep,
            arrival=outbound.arr,
            flight_number=outbound.fltnum.split(",")[0].strip() if outbound.fltnum else "QR1",
            scheduled_departure=outbound_dep_time,
            scheduled_arrival=outbound_arr_time,
            ground_time_minutes=ground_time,
            status="proposed",
            created_by=creator_id,
            week_start=trip_week_start
        )
        db.add(outbound_leg)
        
        # Create inbound flight leg
        inbound_leg = LiveFlightSchedule(
            group_id=group_id,
            aircraft_id=ac.id,
            route_id=inbound.id,
            departure=inbound.dep,
            arrival=inbound.arr,
            flight_number=inbound.fltnum.split(",")[0].strip() if inbound.fltnum else "QR2",
            scheduled_departure=inbound_dep_time,
            scheduled_arrival=inbound_arr_time,
            ground_time_minutes=60,
            status="proposed",
            created_by=creator_id,
            week_start=trip_week_start
        )
        db.add(inbound_leg)
        
        total_created += 2

    await db.commit()
    return total_created
