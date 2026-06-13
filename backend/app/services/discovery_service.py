from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.live_models import LiveRouteDiscovery, RouteAircraft


async def get_pilot_discovery_summary(
    db: AsyncSession, pilot_id: int
) -> list[dict]:
    type_ids_result = await db.execute(
        select(LiveRouteDiscovery.aircraft_type_id, func.count(LiveRouteDiscovery.id))
        .where(LiveRouteDiscovery.pilot_id == pilot_id)
        .group_by(LiveRouteDiscovery.aircraft_type_id)
    )
    discovered_by_type = {row[0]: row[1] for row in type_ids_result.fetchall()}

    all_types_result = await db.execute(
        select(RouteAircraft.aircraftid, func.count(RouteAircraft.id))
        .group_by(RouteAircraft.aircraftid)
    )
    total_by_type = {row[0]: row[1] for row in all_types_result.fetchall()}

    from app.models.live_models import Aircraft

    aircraft_types_result = await db.execute(
        select(Aircraft).where(Aircraft.id.in_(list(set(list(discovered_by_type.keys()) + list(total_by_type.keys())))))
    )
    aircraft_types = {a.id: a.name for a in aircraft_types_result.scalars().all()}

    summary = []
    for type_id, total in total_by_type.items():
        discovered = discovered_by_type.get(type_id, 0)
        summary.append({
            "aircraft_type_id": type_id,
            "aircraft_type_name": aircraft_types.get(type_id, "Unknown"),
            "total_routes": total,
            "discovered_routes": discovered,
            "discovery_pct": round((discovered / total * 100), 2) if total > 0 else 0,
        })

    return sorted(summary, key=lambda x: x["discovery_pct"], reverse=True)


async def get_pilot_discovery_for_type(
    db: AsyncSession, pilot_id: int, aircraft_type_id: int
) -> dict:
    discovered_result = await db.execute(
        select(LiveRouteDiscovery)
        .where(
            LiveRouteDiscovery.pilot_id == pilot_id,
            LiveRouteDiscovery.aircraft_type_id == aircraft_type_id,
        )
    )
    discovered = list(discovered_result.scalars().all())

    all_routes_result = await db.execute(
        select(RouteAircraft).where(RouteAircraft.aircraftid == aircraft_type_id)
    )
    all_routes = list(all_routes_result.scalars().all())

    from app.models.live_models import Route

    discovered_route_ids = [d.route_id for d in discovered if d.route_id]
    discovered_custom = [(d.departure, d.arrival) for d in discovered if not d.route_id]

    routes_result = await db.execute(
        select(Route).where(Route.id.in_(all_routes))
    )
    routes = list(routes_result.scalars().all())

    missing = [r for r in routes if r.id not in discovered_route_ids]

    return {
        "aircraft_type_id": aircraft_type_id,
        "total_routes": len(routes),
        "discovered_routes": len(discovered_route_ids) + len(discovered_custom),
        "discovery_pct": round(((len(discovered_route_ids) + len(discovered_custom)) / len(routes) * 100), 2) if routes else 0,
        "discovered": [
            {"departure": d.departure, "arrival": d.arrival, "flown_at": str(d.flown_at)}
            for d in discovered
        ],
        "missing": [
            {"departure": r.dep, "arrival": r.arr}
            for r in missing
        ],
    }
