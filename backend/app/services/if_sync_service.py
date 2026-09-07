from typing import Any, List, Optional
import math
import asyncio
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
    try:
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
        if not isinstance(client, IFLiveClient):
            return None

        try:
            await client.open()
            sync = IFScheduleSync(client)
            if_id = await sync.push_schedule(
                db, schedule, aircraft.if_organization_aircraft_id
            )
            return if_id
        except Exception:
            return None
        finally:
            try:
                await client.close()
            except Exception:
                pass
    except Exception:
        return None


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
        # 3. Request metadata (optional, fail gracefully as this endpoint returns 500 on IF servers)
        visibility = 1
        try:
            if_aircraft_data = await client.get_aircraft(aircraft.if_organization_aircraft_id)
            if if_aircraft_data.registration:
                aircraft.registration = if_aircraft_data.registration
            if if_aircraft_data.aircraft_id:
                aircraft.if_aircraft_id = if_aircraft_data.aircraft_id
            visibility = if_aircraft_data.visibility
        except Exception as meta_err:
            import logging
            logger = logging.getLogger("uvicorn")
            logger.debug(f"Optional metadata fetch failed for {aircraft.registration}: {meta_err}")
            
        # 4. Check if the aircraft is hangared. If so, return early and bypass position API call
        if visibility == 2:
            aircraft.status = "in_hangar"
            db.add(aircraft)
            return {
                "icao": aircraft.current_airport or "OTHH",
                "status": "in_hangar",
                "registration": aircraft.registration,
                "last_airport": aircraft.last_airport,
                "last_pilot_id": aircraft.last_pilot_id,
                "last_pilot_username": None,
                "last_flight_at": str(aircraft.last_flight_at) if aircraft.last_flight_at else None,
                "latitude": None,
                "longitude": None,
                "is_on_ground": True,
                "skipped_position_fetch": True
            }
            
        # 5. Fetch position coordinates for active aircraft
        position_data = await client.get_aircraft_position(aircraft.if_organization_aircraft_id)
        
        lat = position_data.get("latitude")
        lon = position_data.get("longitude")
        is_on_ground = position_data.get("isOnGround", True)
        state = position_data.get("state", 1)
        updated_at_str = position_data.get("updatedAt")
        last_pilot_id = position_data.get("lastPilotId")
        last_pilot_username = position_data.get("lastPilotUsername")
        
        # 6. Resolve closest airport
        if lat is not None and lon is not None:
            icao = _find_nearest_icao(lat, lon)
        else:
            icao = aircraft.current_airport or "OTHH"
        
        # 7. Map status (visibility is checked above, so status is based on state/isOnGround)
        if state == 5:
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
            "is_on_ground": is_on_ground,
            "skipped_position_fetch": False
        }
    finally:
        await client.close()


_last_full_offline_sync_at: Optional[datetime] = None


async def sync_all_aircraft_locations_optimized(db: AsyncSession) -> dict:
    from app.services.if_live_v2_client import IFLiveV2Client

    # 1. Fetch all linked aircraft
    result = await db.execute(
        select(LiveAircraft).where(LiveAircraft.if_organization_aircraft_id.isnot(None))
    )
    aircraft_list = list(result.scalars().all())
    if not aircraft_list:
        return {"detail": "No linked aircraft found.", "synced": 0}

    # 2. Initialize V2 Client
    v2_client = IFLiveV2Client()
    if v2_client.is_mock:
        # Mock mode: set status of aircraft based on active dispatched bookings
        from app.models.live_models import LiveFlightBooking
        active_bookings_result = await db.execute(
            select(LiveFlightBooking)
            .where(LiveFlightBooking.status == "dispatched")
            .options(selectinload(LiveFlightBooking.schedule))
        )
        active_bookings = list(active_bookings_result.scalars().all())
        active_aircraft_ids = {b.schedule.aircraft_id for b in active_bookings if b.schedule}

        synced_count = 0
        for ac in aircraft_list:
            if ac.id in active_aircraft_ids:
                if ac.status != "flying":
                    ac.status = "flying"
                    ac.current_airport = ac.current_airport or "OTHH"
                    db.add(ac)
                    synced_count += 1
            else:
                if ac.status == "flying":
                    ac.status = "parked"
                    db.add(ac)
                    synced_count += 1
        if synced_count > 0:
            await db.commit()
        return {"detail": "Mock sync completed.", "synced": len(aircraft_list)}

    # Real mode: Fetch Expert session
    try:
        sessions = await v2_client.get_sessions()
        expert_session = next((s for s in sessions if s.get("worldType") == 3), None)
        if not expert_session and sessions:
            expert_session = sessions[0]  # Fallback

        if not expert_session:
            return {"detail": "No active Infinite Flight sessions found.", "synced": 0}

        session_id = expert_session["id"]
        flights = await v2_client.get_flights(session_id)
        flights_by_id = {f.get("flightId"): f for f in flights if f.get("flightId")}

        synced_count = 0
        for ac in aircraft_list:
            flight = flights_by_id.get(ac.if_organization_aircraft_id)
            if flight:
                # Active flying flight
                lat = flight.get("latitude")
                lon = flight.get("longitude")
                speed = flight.get("speed", 0)
                alt = flight.get("altitude", 0)
                is_on_ground = alt < 100 and speed < 50

                icao = _find_nearest_icao(lat, lon) if (lat is not None and lon is not None) else (ac.current_airport or "OTHH")
                new_status = "parked" if is_on_ground else "flying"

                # Detect status or location change
                changed = False
                if ac.status != new_status:
                    ac.status = new_status
                    changed = True
                if ac.current_airport != icao:
                    if new_status == "parked":
                        ac.last_airport = ac.current_airport
                    ac.current_airport = icao
                    changed = True

                last_pilot_username = flight.get("username")
                if last_pilot_username:
                    pilot_result = await db.execute(
                        select(Pilot.id).where(Pilot.ifc == last_pilot_username)
                    )
                    pilot_id = pilot_result.scalar_one_or_none()
                    if pilot_id and ac.last_pilot_id != pilot_id:
                        ac.last_pilot_id = pilot_id
                        changed = True

                if changed:
                    ac.last_flight_at = datetime.utcnow()
                    db.add(ac)
                    synced_count += 1
            else:
                # Not online: if it was flying, set to parked
                if ac.status == "flying":
                    ac.status = "parked"
                    db.add(ac)
                    synced_count += 1

        # 3. Continuous offline fleet sync from V3 (1 request every 5.0s until all updated, then rest 30 mins)
        now = datetime.utcnow()
        global _last_full_offline_sync_at

        # Check if we are currently in the 30-minute rest period
        is_resting = False
        if _last_full_offline_sync_at:
            elapsed_minutes = (now - _last_full_offline_sync_at).total_seconds() / 60.0
            if elapsed_minutes < 30:
                is_resting = True

        if not is_resting:
            offline_candidates = [
                ac for ac in aircraft_list
                if ac.if_organization_aircraft_id not in flights_by_id
                and ac.status not in ("in_hangar", "retired")
            ]

            if offline_candidates:
                import logging
                logger = logging.getLogger("uvicorn")
                logger.info(f"Starting continuous V3 offline fleet sync for {len(offline_candidates)} aircraft (at steady ~10-12 req/min pace)...")

                for i, ac_obj in enumerate(offline_candidates):
                    try:
                        await sync_aircraft_location(db, ac_obj.id)
                        synced_count += 1
                    except Exception as sync_err:
                        err_str = str(sync_err)
                        if "404" in err_str:
                            logger.info(f"Aircraft {ac_obj.registration} not found in Infinite Flight (retired/hangared). Marking as in_hangar.")
                            ac_obj.status = "in_hangar"
                            db.add(ac_obj)
                        else:
                            logger.warning(f"Background V3 offline sync failed for {ac_obj.registration}: {sync_err}")

                    # Delay 5.0 seconds between individual aircraft to strictly enforce a safe ~12 req/min rate limit
                    await asyncio.sleep(5.0)

                _last_full_offline_sync_at = datetime.utcnow()
                logger.info("Completed full fleet offline sync. Offline sync will now rest for 30 minutes.")

        if synced_count > 0:
            await db.commit()
        return {"detail": f"Synced {synced_count} aircraft.", "synced": synced_count}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"detail": f"Sync failed: {str(e)}", "synced": 0}
