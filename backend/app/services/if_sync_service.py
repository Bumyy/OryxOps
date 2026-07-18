from typing import Any
import math
import airportsdata
from datetime import datetime

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import LiveAircraft, LiveFlightSchedule, LiveIFOAuthToken, Pilot
from app.services.if_live_client import (
    IFLiveClient,
    IFScheduleRequest,
    IFTokenManager,
    PersistentFlightType,
)


# ---------------------------------------------------------------------------
# Field mapping helpers
# ---------------------------------------------------------------------------

def _schedule_to_if_request(schedule: LiveFlightSchedule) -> IFScheduleRequest:
    """Convert an OryxOps ``LiveFlightSchedule`` to an IF ``IFScheduleRequest``."""
    return IFScheduleRequest(
        callsign=(schedule.flight_number or "QRV000")[:32],
        flight_type=PersistentFlightType.COMMERCIAL,
        origin_icao=(schedule.departure or "").upper(),
        destination_icao=(schedule.arrival or "").upper(),
        scheduled_departure_utc=_format_datetime(schedule.scheduled_departure),
        scheduled_arrival_utc=_format_datetime(schedule.scheduled_arrival),
    )


def _format_datetime(dt: Any) -> str:
    """Ensure a datetime is an ISO-8601 UTC string."""
    if dt is None:
        return ""
    return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)


# ---------------------------------------------------------------------------
# Sync service
# ---------------------------------------------------------------------------


class IFScheduleSync:
    """Syncs OryxOps ``LiveFlightSchedule`` rows with the IF PublicApi v3 Live
    schedule endpoints.

    Requires a live ``IFLiveClient`` instance configured with a valid access
    token.  All methods that touch the database accept an async SQLAlchemy
    session that the caller must manage (commit, rollback, etc.).
    """

    def __init__(self, client: IFLiveClient):
        self.client = client

    # ------------------------------------------------------------------
    # Single-schedule push
    # ------------------------------------------------------------------

    async def push_schedule(
        self,
        db: AsyncSession,
        schedule: LiveFlightSchedule,
        if_aircraft_id: str,
        flight_type: PersistentFlightType = PersistentFlightType.COMMERCIAL,
    ) -> str:
        """Push *one* local schedule to IF.

        * If ``schedule.if_schedule_id`` is set → updates the existing IF schedule.
        * Otherwise → creates a new IF schedule and stores the returned ID.

        Returns the IF schedule ID.
        """
        request = IFScheduleRequest(
            callsign=(schedule.flight_number or "QRV000")[:32],
            flight_type=flight_type,
            origin_icao=(schedule.departure or "").upper(),
            destination_icao=(schedule.arrival or "").upper(),
            scheduled_departure_utc=_format_datetime(schedule.scheduled_departure),
            scheduled_arrival_utc=_format_datetime(schedule.scheduled_arrival),
        )

        if schedule.if_schedule_id:
            result = await self.client.update_schedule(schedule.if_schedule_id, request)
        else:
            result = await self.client.create_schedule(if_aircraft_id, request)
            schedule.if_schedule_id = result.id
            db.add(schedule)

        return result.id

    # ------------------------------------------------------------------
    # Delete from IF (and clear local link)
    # ------------------------------------------------------------------

    async def delete_if_schedule(
        self, db: AsyncSession, schedule: LiveFlightSchedule
    ) -> bool:
        """Delete the linked IF schedule and clear ``schedule.if_schedule_id``."""
        if not schedule.if_schedule_id:
            return False
        ok = await self.client.delete_schedule(schedule.if_schedule_id)
        if ok:
            schedule.if_schedule_id = None
            db.add(schedule)
        return ok

    # ------------------------------------------------------------------
    # Bulk push for an aircraft
    # ------------------------------------------------------------------

    async def push_schedules_for_aircraft(
        self,
        db: AsyncSession,
        if_aircraft_id: str,
        schedules: list[LiveFlightSchedule],
        flight_type: PersistentFlightType = PersistentFlightType.COMMERCIAL,
    ) -> dict[str, str]:
        """Push a list of local schedules to IF.

        Returns a dict mapping local schedule ID → IF schedule ID.
        """
        results: dict[str, str] = {}
        for sched in schedules:
            if_id = await self.push_schedule(db, sched, if_aircraft_id, flight_type)
            results[str(sched.id)] = if_id
        return results

    # ------------------------------------------------------------------
    # Full sync for an aircraft (push approved, delete stale)
    # ------------------------------------------------------------------

    async def sync_aircraft_schedules(
        self,
        db: AsyncSession,
        if_aircraft_id: str,
        group_id: int,
        week_start: str,
        flight_type: PersistentFlightType = PersistentFlightType.COMMERCIAL,
    ) -> dict:
        """Full two-way sync for one IF aircraft:

        1. Push all *approved* local schedules that don't have an IF ID yet.
        2. Deletes IF schedules that no longer have a matching approved local schedule.

        Returns a summary dict.
        """
        result_schedules = await db.execute(
            select(LiveFlightSchedule).where(
                LiveFlightSchedule.group_id == group_id,
                LiveFlightSchedule.status == "approved",
                LiveFlightSchedule.week_start == week_start,
            )
        )
        local_schedules = list(result_schedules.scalars().all())

        # Push new schedules
        pushed = 0
        for sched in local_schedules:
            if not sched.if_schedule_id:
                await self.push_schedule(db, sched, if_aircraft_id, flight_type)
                pushed += 1

        # Discover which IF schedules should still exist
        local_if_ids = {s.if_schedule_id for s in local_schedules if s.if_schedule_id}

        # Fetch remote schedules and delete orphans
        try:
            if_schedules = await self.client.list_aircraft_schedules(if_aircraft_id)
        except Exception:
            return {"pushed": pushed, "deleted": 0, "error": "Failed to fetch remote schedules"}

        deleted = 0
        for if_sched in if_schedules:
            if if_sched.id not in local_if_ids:
                await self.client.delete_schedule(if_sched.id)
                deleted += 1

        return {"pushed": pushed, "deleted": deleted}


# ---------------------------------------------------------------------------
# Auto-sync helper — called in the background after schedule approval
# ---------------------------------------------------------------------------


async def try_auto_sync_to_if(
    db: AsyncSession,
    schedule: LiveFlightSchedule,
) -> str | None:
    """Push *one* approved schedule to IF, using the first available staff token.

    Called transparently after approval — regular users never see this.
    Returns the IF schedule ID, or ``None`` if IF is not configured.
    """
    # Check if the schedule's aircraft has an IF mapping
    if schedule.aircraft_id is None:
        return None

    result = await db.execute(
        select(LiveAircraft)
        .where(LiveAircraft.id == schedule.aircraft_id)
        .options(selectinload(LiveAircraft.aircraft_type))
    )
    aircraft = result.scalar_one_or_none()
    if aircraft is None or not aircraft.if_organization_aircraft_id:
        return None

    # Find any staff member with a valid IF token
    result = await db.execute(
        select(LiveIFOAuthToken)
        .where(LiveIFOAuthToken.refresh_token != "")
        .where(LiveIFOAuthToken.refresh_token.isnot(None))
    )
    token_row = result.scalars().first()
    if token_row is None:
        return None

    # Build client + sync
    manager = IFTokenManager()
    client = await manager.get_client(db, token_row.pilot_id)
    if isinstance(client, IFLiveClient):
        await client.open()
    else:
        return None

    try:
        sync = IFScheduleSync(client)
        if_id = await sync.push_schedule(
            db, schedule, aircraft.if_organization_aircraft_id
        )
        return if_id
    except Exception:
        return None
    finally:
        await client.close()


# ---------------------------------------------------------------------------
# Location & Metadata Telemetry Syncing
# ---------------------------------------------------------------------------

airports_db = airportsdata.load('ICAO')

def _find_nearest_icao(lat: float, lon: float) -> str:
    min_dist = float('inf')
    closest_icao = "OTHH" # Safe default
    
    # Convert inputs to radians
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    
    for icao, apt in airports_db.items():
        dlat = math.radians(apt['lat']) - lat_rad
        dlon = math.radians(apt['lon']) - lon_rad
        
        a = math.sin(dlat/2)**2 + math.cos(lat_rad) * math.cos(math.radians(apt['lat'])) * math.sin(dlon/2)**2
        if a < min_dist:
            min_dist = a
            closest_icao = icao
            
    return closest_icao


async def sync_aircraft_location(db: AsyncSession, airframe_id: int) -> dict:
    # 1. Fetch the airframe and verify link
    result = await db.execute(select(LiveAircraft).where(LiveAircraft.id == airframe_id))
    aircraft = result.scalar_one_or_none()
    if not aircraft or not aircraft.if_organization_aircraft_id:
        raise ValueError("Aircraft is not linked to Infinite Flight.")
        
    # 2. Get any available staff token to initialize client
    token_result = await db.execute(
        select(LiveIFOAuthToken)
        .where(LiveIFOAuthToken.refresh_token != "")
        .where(LiveIFOAuthToken.refresh_token.isnot(None))
    )
    token_row = token_result.scalars().first()
    if not token_row:
        raise ValueError("No connected Infinite Flight staff token available.")
        
    manager = IFTokenManager()
    client = await manager.get_client(db, token_row.pilot_id)
    await client.open()
    
    try:
        # 3. Request metadata & location concurrently
        if_aircraft_data = await client.get_aircraft(aircraft.if_organization_aircraft_id)
        position_data = await client.get_aircraft_position(aircraft.if_organization_aircraft_id)
        
        # Sync basic metadata
        if if_aircraft_data.registration:
            aircraft.registration = if_aircraft_data.registration
        if if_aircraft_data.aircraft_id:
            aircraft.if_aircraft_id = if_aircraft_data.aircraft_id
            
        lat = position_data.get("latitude")
        lon = position_data.get("longitude")
        is_on_ground = position_data.get("isOnGround", True)
        state = position_data.get("state", 1)
        updated_at_str = position_data.get("updatedAt")
        last_pilot_id = position_data.get("lastPilotId")
        last_pilot_username = position_data.get("lastPilotUsername")
        
        # 4. Resolve closest airport
        if lat is not None and lon is not None:
            icao = _find_nearest_icao(lat, lon)
        else:
            icao = aircraft.current_airport or "OTHH"
        
        # 5. Map Infinite Flight states & visibility to OryxOps status enums
        # Visibility values: 2 = Hangared
        # State values: 5 = Maintenance, 2 = InFlight
        if if_aircraft_data.visibility == 2:
            new_status = "in_hangar"
        elif state == 5:
            new_status = "maintenance"
        elif not is_on_ground or state == 2:
            new_status = "flying"
        else:
            new_status = "parked"
            
        # 6. Track previous location as last_airport if it has moved
        if aircraft.current_airport != icao and new_status == "parked":
            aircraft.last_airport = aircraft.current_airport
            
        aircraft.current_airport = icao
        aircraft.status = new_status
        
        # 7. Resolve last pilot from database using IF ID or Username
        resolved_pilot_id = None
        if last_pilot_id or last_pilot_username:
            conditions = []
            if last_pilot_id:
                conditions.append(Pilot.ifuserid == last_pilot_id)
            if last_pilot_username:
                conditions.append(Pilot.ifc == last_pilot_username)
                
            pilot_result = await db.execute(
                select(Pilot.id).where(or_(*conditions))
            )
            resolved_pilot_id = pilot_result.scalar_one_or_none()
            if resolved_pilot_id:
                aircraft.last_pilot_id = resolved_pilot_id
                
        if updated_at_str:
            try:
                # Replace Z with UTC offset for isoformat parsing
                dt = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
                aircraft.last_flight_at = dt.replace(tzinfo=None)
            except Exception:
                pass
                
        db.add(aircraft)
        
        return {
            "icao": icao,
            "status": new_status,
            "registration": aircraft.registration,
            "last_airport": aircraft.last_airport,
            "last_pilot_id": resolved_pilot_id,
            "last_pilot_username": last_pilot_username,
            "last_flight_at": str(aircraft.last_flight_at) if aircraft.last_flight_at else None,
            "latitude": lat,
            "longitude": lon,
            "is_on_ground": is_on_ground
        }
    finally:
        await client.close()
