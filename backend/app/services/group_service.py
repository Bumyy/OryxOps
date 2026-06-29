from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import (
    LiveAircraft,
    LiveFlyingGroup,
    LiveGroupAircraft,
    LiveGroupPilot,
    Pilot,
)


async def get_all_groups(db: AsyncSession, active_only: bool = True) -> list[LiveFlyingGroup]:
    query = select(LiveFlyingGroup)
    if active_only:
        query = query.where(LiveFlyingGroup.is_active == 1)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_group_with_members_aircraft(
    db: AsyncSession, group_id: int
) -> LiveFlyingGroup | None:
    result = await db.execute(
        select(LiveFlyingGroup)
        .where(LiveFlyingGroup.id == group_id)
        .options(
            selectinload(LiveFlyingGroup.group_pilots).selectinload(LiveGroupPilot.pilot),
            selectinload(LiveFlyingGroup.group_aircraft)
            .selectinload(LiveGroupAircraft.aircraft)
            .selectinload(LiveAircraft.aircraft_type),
        )
    )
    return result.scalar_one_or_none()


async def get_group_members(db: AsyncSession, group_id: int) -> list[LiveGroupPilot]:
    result = await db.execute(
        select(LiveGroupPilot)
        .where(
            LiveGroupPilot.group_id == group_id,
            LiveGroupPilot.removed_at.is_(None),
        )
        .options(selectinload(LiveGroupPilot.pilot))
    )
    return list(result.scalars().all())


async def get_group_aircraft(db: AsyncSession, group_id: int) -> list[LiveGroupAircraft]:
    result = await db.execute(
        select(LiveGroupAircraft)
        .where(
            LiveGroupAircraft.group_id == group_id,
            LiveGroupAircraft.removed_at.is_(None),
        )
        .options(
            selectinload(LiveGroupAircraft.aircraft).selectinload(LiveAircraft.aircraft_type)
        )
    )
    return list(result.scalars().all())


async def get_pilot_active_group(db: AsyncSession, pilot_id: int) -> LiveFlyingGroup | None:
    result = await db.execute(
        select(LiveFlyingGroup)
        .join(LiveGroupPilot, LiveGroupPilot.group_id == LiveFlyingGroup.id)
        .where(
            LiveGroupPilot.pilot_id == pilot_id,
            LiveGroupPilot.removed_at.is_(None),
            LiveFlyingGroup.is_active == 1,
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_group(db: AsyncSession, data: dict) -> LiveFlyingGroup:
    group = LiveFlyingGroup(**data)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


async def update_group(db: AsyncSession, group_id: int, data: dict) -> LiveFlyingGroup | None:
    result = await db.execute(select(LiveFlyingGroup).where(LiveFlyingGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(group, key, value)
    await db.commit()
    await db.refresh(group)
    return group


async def get_group_member_count(db: AsyncSession, group_id: int) -> int:
    result = await db.execute(
        select(func.count(LiveGroupPilot.id)).where(
            LiveGroupPilot.group_id == group_id,
            LiveGroupPilot.removed_at.is_(None),
        )
    )
    return result.scalar() or 0


async def get_group_aircraft_count(db: AsyncSession, group_id: int) -> int:
    result = await db.execute(
        select(func.count(LiveGroupAircraft.id)).where(
            LiveGroupAircraft.group_id == group_id,
            LiveGroupAircraft.removed_at.is_(None),
        )
    )
    return result.scalar() or 0


async def assign_pilots_to_group(
    db: AsyncSession, group_id: int, pilot_ids: list[int], is_group_admin: bool = False
) -> list[LiveGroupPilot]:
    assignments = []
    for pilot_id in pilot_ids:
        exists_result = await db.execute(
            select(LiveGroupPilot).where(
                LiveGroupPilot.group_id == group_id,
                LiveGroupPilot.pilot_id == pilot_id,
                LiveGroupPilot.removed_at.is_(None),
            )
        )
        if exists_result.scalar_one_or_none():
            continue

        assignment = LiveGroupPilot(
            group_id=group_id,
            pilot_id=pilot_id,
            is_group_admin=1 if is_group_admin else 0,
        )
        db.add(assignment)
        assignments.append(assignment)

        # Also update Pilot's flying_groupid
        pilot_result = await db.execute(select(Pilot).where(Pilot.id == pilot_id))
        p = pilot_result.scalar_one_or_none()
        if p:
            p.flying_groupid = group_id

    await db.commit()
    return assignments


async def assign_aircraft_to_group(
    db: AsyncSession, group_id: int, aircraft_ids: list[int]
) -> list[LiveGroupAircraft]:
    assignments = []
    for aircraft_id in aircraft_ids:
        exists_result = await db.execute(
            select(LiveGroupAircraft).where(
                LiveGroupAircraft.group_id == group_id,
                LiveGroupAircraft.aircraft_id == aircraft_id,
                LiveGroupAircraft.removed_at.is_(None),
            )
        )
        if exists_result.scalar_one_or_none():
            continue

        assignment = LiveGroupAircraft(
            group_id=group_id,
            aircraft_id=aircraft_id,
        )
        db.add(assignment)
        assignments.append(assignment)

    await db.commit()
    return assignments


async def remove_pilot_from_group(
    db: AsyncSession, group_id: int, pilot_id: int
) -> bool:
    result = await db.execute(
        select(LiveGroupPilot).where(
            LiveGroupPilot.group_id == group_id,
            LiveGroupPilot.pilot_id == pilot_id,
            LiveGroupPilot.removed_at.is_(None),
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return False
    assignment.removed_at = datetime.utcnow()

    # Also update Pilot's flying_groupid to 0
    pilot_result = await db.execute(select(Pilot).where(Pilot.id == pilot_id))
    p = pilot_result.scalar_one_or_none()
    if p and p.flying_groupid == group_id:
        p.flying_groupid = 0

    await db.commit()
    return True


async def remove_aircraft_from_group(
    db: AsyncSession, group_id: int, aircraft_id: int
) -> bool:
    result = await db.execute(
        select(LiveGroupAircraft).where(
            LiveGroupAircraft.group_id == group_id,
            LiveGroupAircraft.aircraft_id == aircraft_id,
            LiveGroupAircraft.removed_at.is_(None),
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return False
    assignment.removed_at = datetime.utcnow()
    await db.commit()
    return True


async def toggle_group_admin(
    db: AsyncSession, group_id: int, pilot_id: int, is_admin: bool
) -> LiveGroupPilot | None:
    result = await db.execute(
        select(LiveGroupPilot).where(
            LiveGroupPilot.group_id == group_id,
            LiveGroupPilot.pilot_id == pilot_id,
            LiveGroupPilot.removed_at.is_(None),
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return None
    assignment.is_group_admin = 1 if is_admin else 0
    await db.commit()
    await db.refresh(assignment)
    return assignment
