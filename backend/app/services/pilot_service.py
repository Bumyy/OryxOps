from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import (
    LiveAircraft,
    LiveFlyingGroup,
    LiveGroupAircraft,
    LiveGroupPilot,
    LiveCurrency,
    Pilot,
    Pirep,
    AwardGranted,
)


async def get_pilot_list(
    db: AsyncSession,
    group_id: int | None = None,
) -> list[Pilot]:
    query = select(Pilot).where(Pilot.status == 1)

    # Filter by award ID 9 (Oryxops)
    subquery = select(AwardGranted.pilotid).where(AwardGranted.awardid == 9)
    query = query.where(Pilot.id.in_(subquery))

    if group_id:
        group_pilot_sub = (
            select(LiveGroupPilot.pilot_id)
            .where(LiveGroupPilot.group_id == group_id, LiveGroupPilot.removed_at.is_(None))
        )
        query = query.where(Pilot.id.in_(group_pilot_sub))

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
        select(LiveCurrency).where(LiveCurrency.pilot_id == pilot_id)
    )
    token = token_result.scalar_one_or_none()
    if not token:
        token = LiveCurrency(pilot_id=pilot_id, balance=0, total_earned=0, total_spent=0)
        db.add(token)
        await db.flush()

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

    return {
        "pilot": pilot,
        "token_balance": token.balance if token else 0,
        "group_name": group.name if group else None,
        "group_id": group.id if group else None,
    }


async def get_pilot_takeoffs_landings(db: AsyncSession, pilot_id: int) -> tuple[int, int]:
    count_result = await db.execute(
        select(func.count(Pirep.id)).where(Pirep.pilotid == pilot_id)
    )
    count = count_result.scalar() or 0
    return count, count
