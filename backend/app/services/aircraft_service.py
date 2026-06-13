from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import (
    Aircraft,
    LiveAircraft,
    LiveFlyingGroup,
    LiveGroupAircraft,
    ParkingPosition,
    Pilot,
    Pirep,
)


async def get_aircraft_types(db: AsyncSession) -> list[Aircraft]:
    result = await db.execute(select(Aircraft))
    return list(result.scalars().all())


async def get_all_airframes(
    db: AsyncSession,
    status: str | None = None,
    group_id: int | None = None,
    airport: str | None = None,
) -> list[LiveAircraft]:
    query = select(LiveAircraft).options(
        selectinload(LiveAircraft.aircraft_type),
        selectinload(LiveAircraft.current_pilot),
        selectinload(LiveAircraft.last_pilot),
    )

    if status:
        query = query.where(LiveAircraft.status == status)

    if group_id:
        group_ac_sub = (
            select(LiveGroupAircraft.aircraft_id)
            .where(LiveGroupAircraft.group_id == group_id, LiveGroupAircraft.removed_at.is_(None))
        )
        query = query.where(LiveAircraft.id.in_(group_ac_sub))

    if airport:
        query = query.where(LiveAircraft.current_airport == airport)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_airframe(db: AsyncSession, airframe_id: int) -> LiveAircraft | None:
    result = await db.execute(
        select(LiveAircraft)
        .where(LiveAircraft.id == airframe_id)
        .options(
            selectinload(LiveAircraft.aircraft_type),
            selectinload(LiveAircraft.current_pilot),
            selectinload(LiveAircraft.last_pilot),
            selectinload(LiveAircraft.current_parking),
        )
    )
    return result.scalar_one_or_none()


async def get_airframe_history(db: AsyncSession, airframe_id: int) -> list[Pirep]:
    airframe = await get_airframe(db, airframe_id)
    if not airframe:
        return []

    result = await db.execute(
        select(Pirep)
        .where(Pirep.trackedaircraftid == airframe_id)
        .options(selectinload(Pirep.pilot))
        .order_by(Pirep.date.desc())
    )
    return list(result.scalars().all())


async def create_airframe(db: AsyncSession, data: dict) -> LiveAircraft:
    airframe = LiveAircraft(**data)
    db.add(airframe)
    await db.commit()
    await db.refresh(airframe)
    return airframe


async def update_airframe(db: AsyncSession, airframe_id: int, data: dict) -> LiveAircraft | None:
    airframe = await get_airframe(db, airframe_id)
    if not airframe:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(airframe, key, value)
    await db.commit()
    await db.refresh(airframe)
    return airframe


async def get_airframe_group_name(db: AsyncSession, airframe_id: int) -> str | None:
    result = await db.execute(
        select(LiveFlyingGroup.name)
        .join(LiveGroupAircraft, LiveGroupAircraft.group_id == LiveFlyingGroup.id)
        .where(
            LiveGroupAircraft.aircraft_id == airframe_id,
            LiveGroupAircraft.removed_at.is_(None),
        )
    )
    return result.scalar_one_or_none()
