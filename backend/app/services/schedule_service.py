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
    LiveTokens,
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
