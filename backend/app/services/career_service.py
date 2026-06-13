from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import (
    Aircraft,
    LiveCareerPath,
    LiveCareerRank,
    LiveCareerRankAircraft,
    LivePilotCareer,
    LiveRouteDiscovery,
    RouteAircraft,
)


async def get_all_career_paths(db: AsyncSession) -> list[LiveCareerPath]:
    result = await db.execute(
        select(LiveCareerPath)
        .where(LiveCareerPath.is_active == 1)
        .options(selectinload(LiveCareerPath.ranks))
    )
    return list(result.scalars().all())


async def get_career_path_with_ranks(db: AsyncSession, path_id: int) -> LiveCareerPath | None:
    result = await db.execute(
        select(LiveCareerPath)
        .where(LiveCareerPath.id == path_id)
        .options(
            selectinload(LiveCareerPath.ranks).selectinload(LiveCareerRank.rank_aircraft).selectinload(LiveCareerRankAircraft.aircraft_type)
        )
    )
    return result.scalar_one_or_none()


async def get_pilot_careers(db: AsyncSession, pilot_id: int) -> list[LivePilotCareer]:
    result = await db.execute(
        select(LivePilotCareer)
        .where(LivePilotCareer.pilot_id == pilot_id)
        .options(
            selectinload(LivePilotCareer.career_path),
            selectinload(LivePilotCareer.current_rank),
        )
    )
    return list(result.scalars().all())


async def get_pilot_career_progress(
    db: AsyncSession, pilot_id: int, career_path_id: int
) -> dict | None:
    pilot_career_result = await db.execute(
        select(LivePilotCareer)
        .where(LivePilotCareer.pilot_id == pilot_id, LivePilotCareer.career_path_id == career_path_id)
        .options(
            selectinload(LivePilotCareer.career_path),
            selectinload(LivePilotCareer.current_rank),
        )
    )
    pilot_career = pilot_career_result.scalar_one_or_none()
    if not pilot_career:
        return None

    current_rank = pilot_career.current_rank

    next_rank_result = await db.execute(
        select(LiveCareerRank)
        .where(
            LiveCareerRank.career_path_id == career_path_id,
            LiveCareerRank.sort_order > current_rank.sort_order,
        )
        .order_by(LiveCareerRank.sort_order)
        .limit(1)
    )
    next_rank = next_rank_result.scalar_one_or_none()

    rank_aircraft_result = await db.execute(
        select(LiveCareerRankAircraft).where(
            LiveCareerRankAircraft.career_rank_id == current_rank.id
        )
    )
    rank_aircraft = list(rank_aircraft_result.scalars().all())
    aircraft_type_ids = [ra.aircraft_type_id for ra in rank_aircraft]

    total_routes = 0
    discovered_routes = 0

    if aircraft_type_ids:
        route_count_result = await db.execute(
            select(func.count(RouteAircraft.id)).where(
                RouteAircraft.aircraftid.in_(aircraft_type_ids)
            )
        )
        total_routes = route_count_result.scalar() or 0

        if total_routes > 0:
            discovery_count_result = await db.execute(
                select(func.count(LiveRouteDiscovery.id)).where(
                    LiveRouteDiscovery.pilot_id == pilot_id,
                    LiveRouteDiscovery.aircraft_type_id.in_(aircraft_type_ids),
                )
            )
            discovered_routes = discovery_count_result.scalar() or 0

    discovery_pct = (discovered_routes / total_routes * 100) if total_routes > 0 else 0
    route_pct_complete = discovery_pct >= float(current_rank.required_route_pct)

    takeoffs_count = 0
    landings_count = 0
    from app.models.live_models import Pirep

    pirep_stats_result = await db.execute(
        select(Pirep.pilotid).where(Pirep.pilotid == pilot_id)
    )
    pireps = pirep_stats_result.scalars().all()

    takeoffs_count = len(pireps)
    landings_count = len(pireps)

    takeoffs_complete = takeoffs_count >= current_rank.required_takeoffs
    landings_complete = landings_count >= current_rank.required_landings

    can_promote = (
        route_pct_complete
        and takeoffs_complete
        and landings_complete
        and next_rank is not None
    )

    return {
        "pilot_career": pilot_career,
        "current_rank": current_rank,
        "next_rank": next_rank,
        "total_routes": total_routes,
        "discovered_routes": discovered_routes,
        "discovery_pct": round(discovery_pct, 2),
        "route_pct_required": float(current_rank.required_route_pct),
        "route_pct_complete": route_pct_complete,
        "takeoffs_count": takeoffs_count,
        "takeoffs_required": current_rank.required_takeoffs,
        "takeoffs_complete": takeoffs_complete,
        "landings_count": landings_count,
        "landings_required": current_rank.required_landings,
        "landings_complete": landings_complete,
        "can_promote": can_promote,
    }


async def create_career_rank(
    db: AsyncSession, career_path_id: int, data: dict
) -> LiveCareerRank:
    rank = LiveCareerRank(career_path_id=career_path_id, **data)
    db.add(rank)
    await db.commit()
    await db.refresh(rank)
    return rank


async def update_career_rank(
    db: AsyncSession, rank_id: int, data: dict
) -> LiveCareerRank | None:
    result = await db.execute(select(LiveCareerRank).where(LiveCareerRank.id == rank_id))
    rank = result.scalar_one_or_none()
    if not rank:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(rank, key, value)
    await db.commit()
    await db.refresh(rank)
    return rank


async def promote_pilot(
    db: AsyncSession, pilot_id: int, career_path_id: int
) -> LivePilotCareer | None:
    pilot_career_result = await db.execute(
        select(LivePilotCareer).where(
            LivePilotCareer.pilot_id == pilot_id,
            LivePilotCareer.career_path_id == career_path_id,
        )
    )
    pilot_career = pilot_career_result.scalar_one_or_none()
    if not pilot_career:
        return None

    next_rank_result = await db.execute(
        select(LiveCareerRank)
        .where(
            LiveCareerRank.career_path_id == career_path_id,
            LiveCareerRank.sort_order > pilot_career.current_rank.sort_order,
        )
        .order_by(LiveCareerRank.sort_order)
        .limit(1)
    )
    next_rank = next_rank_result.scalar_one_or_none()
    if not next_rank:
        return None

    from datetime import datetime

    pilot_career.previous_rank_id = pilot_career.current_rank_id
    pilot_career.current_rank_id = next_rank.id
    pilot_career.promoted_at = datetime.utcnow()

    await db.commit()
    await db.refresh(pilot_career)
    return pilot_career
