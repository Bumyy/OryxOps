from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import (
    LiveAircraft,
    LiveFlyingGroup,
    LiveGroupAircraft,
    LiveGroupPilot,
    LivePilotCareer,
    LiveTokens,
    Pilot,
    Pirep,
)


async def get_pilot_list(
    db: AsyncSession,
    group_id: int | None = None,
    career_path_id: int | None = None,
    rank_id: int | None = None,
) -> list[Pilot]:
    query = select(Pilot).where(Pilot.status == 1)

    if group_id:
        group_pilot_sub = (
            select(LiveGroupPilot.pilot_id)
            .where(LiveGroupPilot.group_id == group_id, LiveGroupPilot.removed_at.is_(None))
        )
        query = query.where(Pilot.id.in_(group_pilot_sub))

    if career_path_id:
        career_sub = (
            select(LivePilotCareer.pilot_id)
            .where(LivePilotCareer.career_path_id == career_path_id)
        )
        query = query.where(Pilot.id.in_(career_sub))

    if rank_id:
        career_sub = (
            select(LivePilotCareer.pilot_id)
            .where(LivePilotCareer.current_rank_id == rank_id)
        )
        query = query.where(Pilot.id.in_(career_sub))

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_pilot_detail(db: AsyncSession, pilot_id: int) -> dict | None:
    pilot_result = await db.execute(
        select(Pilot).where(Pilot.id == pilot_id)
    )
    pilot = pilot_result.scalar_one_or_none()
    if not pilot:
        return None

    token_result = await db.execute(
        select(LiveTokens).where(LiveTokens.pilot_id == pilot_id)
    )
    token = token_result.scalar_one_or_none()

    group_result = await db.execute(
        select(LiveFlyingGroup)
        .join(LiveGroupPilot, LiveGroupPilot.group_id == LiveFlyingGroup.id)
        .where(
            LiveGroupPilot.pilot_id == pilot_id,
            LiveGroupPilot.removed_at.is_(None),
        )
        .limit(1)
    )
    group = group_result.scalar_one_or_none()

    career_result = await db.execute(
        select(LivePilotCareer)
        .where(LivePilotCareer.pilot_id == pilot_id)
        .options(
            selectinload(LivePilotCareer.career_path),
            selectinload(LivePilotCareer.current_rank),
        )
    )
    careers = list(career_result.scalars().all())

    return {
        "pilot": pilot,
        "token_balance": token.balance if token else 0,
        "group_name": group.name if group else None,
        "group_id": group.id if group else None,
        "careers": [
            {
                "path": c.career_path.name,
                "rank": c.current_rank.name,
                "sort_order": c.current_rank.sort_order,
            }
            for c in careers
        ],
    }


async def get_pilot_takeoffs_landings(db: AsyncSession, pilot_id: int) -> tuple[int, int]:
    count_result = await db.execute(
        select(func.count(Pirep.id)).where(Pirep.pilotid == pilot_id)
    )
    count = count_result.scalar() or 0
    return count, count
