from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_staff
from app.models.live_models import LiveAircraft, LiveFlightSchedule, Pilot
from app.services.if_live_client import IFLiveClient, IFTokenManager
from app.services.if_sync_service import IFScheduleSync, sync_aircraft_location

router = APIRouter(prefix="/infinite-flight", tags=["infinite-flight"])

_manager = IFTokenManager()


def _normalize_reg(reg: str) -> set[str]:
    """Return registration variants to try matching against: with and without dashes."""
    cleaned = reg.strip().upper()
    return {cleaned, cleaned.replace("-", "")}


async def _get_if_client(db: AsyncSession, pilot: Pilot) -> IFLiveClient:
    try:
        client = await _manager.get_client(db, pilot.id)
    except Exception as e:
        from app.models.live_models import LiveIFOAuthToken
        from sqlalchemy import select

        # If refresh fails, clear the bad tokens so admin can re-connect
        result = await db.execute(
            select(LiveIFOAuthToken).where(LiveIFOAuthToken.pilot_id == pilot.id)
        )
        row = result.scalar_one_or_none()
        if row:
            row.refresh_token = ""
            db.add(row)
            await db.commit()

        raise HTTPException(
            status_code=401,
            detail="IF token expired or revoked. Re-authorize from Settings → Infinite Flight Live.",
        )
    await client.open()
    return client


# ------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------


@router.get("/auth/authorize")
async def if_authorize(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Start the OAuth2 flow. Returns the Infinite Flight authorize URL."""
    url = await _manager.begin_authorization(db, pilot.id)
    return {"authorize_url": url}


@router.get("/auth/callback")
async def if_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Handle the OAuth2 redirect from Infinite Flight."""
    try:
        token_data = await _manager.handle_callback(db, pilot.id, code, state)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "connected",
        "scope": token_data.get("scope", _manager.scopes),
        "expires_in": token_data.get("expires_in", 1800),
    }


@router.get("/auth/status")
async def if_auth_status(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Check whether the pilot has a stored IF OAuth token."""
    from app.models.live_models import LiveIFOAuthToken
    from sqlalchemy import select

    result = await db.execute(
        select(LiveIFOAuthToken).where(LiveIFOAuthToken.pilot_id == pilot.id)
    )
    row = result.scalar_one_or_none()

    if row is None or not row.refresh_token:
        return {"connected": False}

    return {
        "connected": True,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "has_refresh_token": bool(row.refresh_token),
        "scopes": row.scope,
    }


@router.post("/auth/revoke")
async def if_revoke(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Revoke (delete) the stored IF OAuth token."""
    await _manager.revoke(db, pilot.id)
    return {"status": "revoked"}


# ------------------------------------------------------------------
# Data fetching (read-only)
# ------------------------------------------------------------------


@router.get("/organizations")
async def if_list_organizations(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    client = await _get_if_client(db, pilot)
    try:
        orgs = await client.list_organizations()
        return [
            {
                "id": o.id,
                "name": o.name,
                "type": o.type,
                "operation_type": o.operation_type,
                "world_type": o.world_type,
                "description": o.description,
            }
            for o in orgs
        ]
    finally:
        await client.close()


@router.get("/organizations/{organization_id}/aircraft")
async def if_list_org_aircraft(
    organization_id: str,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    client = await _get_if_client(db, pilot)
    try:
        aircraft = await client.list_organization_aircraft(organization_id)
        return [
            {
                "id": a.id,
                "aircraft_id": a.aircraft_id,
                "organization_id": a.organization_id,
                "registration": a.registration,
                "visibility": a.visibility,
                "created_at": a.created_at,
            }
            for a in aircraft
        ]
    finally:
        await client.close()


@router.get("/aircraft/matches")
async def if_aircraft_matches(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Return IF aircraft alongside local aircraft, with match suggestions."""
    from sqlalchemy import select

    client = await _get_if_client(db, pilot)
    try:
        orgs = await client.list_organizations()
    finally:
        await client.close()

    if_aircraft: list[dict] = []
    for org in orgs:
        client2 = await _get_if_client(db, pilot)
        try:
            ac_list = await client2.list_organization_aircraft(org.id)
            for a in ac_list:
                if_aircraft.append({
                    "id": a.id,
                    "registration": a.registration,
                    "organization_id": a.organization_id,
                    "organization_name": org.name,
                    "visibility": a.visibility,
                })
        finally:
            await client2.close()

    result = await db.execute(select(LiveAircraft))
    local_aircraft = list(result.scalars().all())

    if_regs = {a["registration"].replace("-", "").lower(): a for a in if_aircraft}

    def _find_match(local_reg: str):
        for variant in _normalize_reg(local_reg):
            key = variant.replace("-", "").lower()
            if key in if_regs:
                return if_regs[key]
        return None

    matches = []
    for la in local_aircraft:
        match = _find_match(la.registration)
        matches.append({
            "local_id": la.id,
            "local_registration": la.registration,
            "if_aircraft_id": la.if_organization_aircraft_id,
            "suggested_if_aircraft": {
                "id": match["id"],
                "registration": match["registration"],
                "organization_name": match["organization_name"],
            } if match else None,
            "linked": la.if_organization_aircraft_id is not None,
        })

    unmapped_if = [a for a in if_aircraft if not any(
        la.if_organization_aircraft_id == a["id"] for la in local_aircraft
    )]

    return {"matches": matches, "unmapped_if_aircraft": unmapped_if}


@router.post("/aircraft/sync-all")
async def if_sync_all_aircraft(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Auto-link all local aircraft to IF aircraft by matching registration.

    Call this once after connecting IF, or whenever new aircraft are added.
    """
    from sqlalchemy import select

    client = await _get_if_client(db, pilot)
    try:
        orgs = await client.list_organizations()
    finally:
        await client.close()

    if_aircraft: list[dict] = []
    for org in orgs:
        client2 = await _get_if_client(db, pilot)
        try:
            ac_list = await client2.list_organization_aircraft(org.id)
            for a in ac_list:
                if_aircraft.append({
                    "id": a.id,
                    "registration": a.registration,
                })
        finally:
            await client2.close()

    result = await db.execute(select(LiveAircraft))
    local_aircraft = list(result.scalars().all())

    linked = 0
    skipped = 0
    for la in local_aircraft:
        if la.if_organization_aircraft_id:
            skipped += 1
            continue
        local_variants = _normalize_reg(la.registration)
        match = next(
            (a for a in if_aircraft
             if any(v.replace("-", "").lower() == a["registration"].replace("-", "").lower()
                    for v in local_variants)),
            None,
        )
        if match:
            la.if_organization_aircraft_id = match["id"]
            db.add(la)
            linked += 1

    await db.commit()
    return {"linked": linked, "already_linked": skipped, "unmatched": len(local_aircraft) - linked - skipped}


@router.get("/aircraft/fleet-status")
async def if_fleet_status(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Return IF data for all linked local aircraft."""
    from sqlalchemy import select

    result = await db.execute(
        select(LiveAircraft).where(LiveAircraft.if_organization_aircraft_id.isnot(None))
    )
    linked = list(result.scalars().all())
    if not linked:
        return {"aircraft": [], "error": None}

    try:
        client = await _get_if_client(db, pilot)
    except HTTPException:
        from app.models.live_models import LiveIFOAuthToken
        token_result = await db.execute(
            select(LiveIFOAuthToken)
            .where(LiveIFOAuthToken.refresh_token != "")
            .where(LiveIFOAuthToken.refresh_token.isnot(None))
        )
        token_row = token_result.scalars().first()
        if token_row is None:
            return {"aircraft": [], "error": "Not connected to Infinite Flight"}
        try:
            client = await _manager.get_client(db, token_row.pilot_id)
            await client.open()
        except Exception:
            return {"aircraft": [], "error": "Not connected to Infinite Flight"}

    try:
        orgs = await client.list_organizations()
        org_names = {o.id: o.name for o in orgs}
        results: list[dict] = []

        for org in orgs:
            ac_list = await client.list_organization_aircraft(org.id)
            if_ac_map = {a.id: a for a in ac_list}

            for la in linked:
                if la.if_organization_aircraft_id in if_ac_map:
                    a = if_ac_map[la.if_organization_aircraft_id]
                    results.append({
                        "local_id": la.id,
                        "local_registration": la.registration,
                        "if_aircraft_id": a.id,
                        "if_aircraft_content_id": a.aircraft_id,
                        "if_registration": a.registration,
                        "if_organization_id": a.organization_id,
                        "if_organization_name": org.name,
                        "if_status": a.status,
                        "if_visibility": a.visibility,
                        "if_created_at": a.created_at,
                    })

        return {"aircraft": results, "error": None}
    except Exception as e:
        return {"aircraft": [], "error": f"IF API unavailable: {e}"}
    finally:
        await client.close()


@router.post("/aircraft/{local_aircraft_id}/link")
async def if_link_aircraft(
    local_aircraft_id: int,
    if_aircraft_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Link a local aircraft to an IF aircraft ID."""
    from sqlalchemy import select

    result = await db.execute(
        select(LiveAircraft).where(LiveAircraft.id == local_aircraft_id)
    )
    ac = result.scalar_one_or_none()
    if ac is None:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    ac.if_organization_aircraft_id = if_aircraft_id
    db.add(ac)
    await db.commit()
    return {"local_id": local_aircraft_id, "if_aircraft_id": if_aircraft_id, "linked": True}


@router.get("/aircraft/{aircraft_id}/schedules")
async def if_list_aircraft_schedules(
    aircraft_id: str,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    client = await _get_if_client(db, pilot)
    try:
        schedules = await client.list_aircraft_schedules(aircraft_id)
        return [
            {
                "id": s.id,
                "status": s.status,
                "callsign": s.callsign,
                "flight_type": s.flight_type,
                "origin_icao": s.origin_icao,
                "destination_icao": s.destination_icao,
                "scheduled_departure_utc": s.scheduled_departure_utc,
                "scheduled_arrival_utc": s.scheduled_arrival_utc,
                "flight_plan": s.flight_plan,
                "sequence": s.sequence,
            }
            for s in schedules
        ]
    finally:
        await client.close()


# ------------------------------------------------------------------
# Sync — push local schedules to IF
# ------------------------------------------------------------------


@router.post("/sync/aircraft/{if_aircraft_id}")
async def if_sync_aircraft(
    if_aircraft_id: str,
    group_id: int = Query(...),
    week_start: str = Query(...),
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Push approved local schedules to IF for the given aircraft."""
    client = await _get_if_client(db, pilot)
    try:
        sync = IFScheduleSync(client)
        result = await sync.sync_aircraft_schedules(
            db, if_aircraft_id, group_id, week_start
        )
        await db.commit()
        return result
    finally:
        await client.close()


@router.post("/sync/schedule/{schedule_id}")
async def if_push_schedule(
    schedule_id: int,
    if_aircraft_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Push a single local schedule to IF."""
    from sqlalchemy import select

    result = await db.execute(
        select(LiveFlightSchedule).where(LiveFlightSchedule.id == schedule_id)
    )
    schedule: LiveFlightSchedule | None = result.scalar_one_or_none()
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    client = await _get_if_client(db, pilot)
    try:
        sync = IFScheduleSync(client)
        if_id = await sync.push_schedule(db, schedule, if_aircraft_id)
        await db.commit()
        return {"if_schedule_id": if_id}
    finally:
        await client.close()


@router.delete("/sync/schedule/{schedule_id}")
async def if_delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    """Delete the linked IF schedule (and clear the local IF ID)."""
    from sqlalchemy import select

    result = await db.execute(
        select(LiveFlightSchedule).where(LiveFlightSchedule.id == schedule_id)
    )
    schedule: LiveFlightSchedule | None = result.scalar_one_or_none()
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    client = await _get_if_client(db, pilot)
    try:
        sync = IFScheduleSync(client)
        ok = await sync.delete_if_schedule(db, schedule)
        await db.commit()
        return {"deleted": ok}
    finally:
        await client.close()


@router.post("/aircraft/{airframe_id}/sync-location")
async def if_sync_aircraft_location(
    airframe_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff)
):
    """Fetch exact position and details from IF API and update the airframe database record."""
    try:
        res = await sync_aircraft_location(db, airframe_id)
        await db.commit()
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Details sync failed: {str(e)}")


@router.post("/aircraft/sync-all-locations")
async def if_sync_all_locations(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff)
):
    """Fetch exact position and details for all linked aircraft, respecting rate limits."""
    import asyncio
    from sqlalchemy import select
    
    result = await db.execute(
        select(LiveAircraft).where(LiveAircraft.if_organization_aircraft_id.isnot(None))
    )
    linked = list(result.scalars().all())
    if not linked:
        return {"detail": "No linked aircraft found.", "synced": 0}
        
    success = 0
    failed = 0
    errors = []
    
    for ac in linked:
        try:
            res = await sync_aircraft_location(db, ac.id)
            # If the plane was active and we fetched position, delay 3.0s to stay below 20 requests/min
            if not res.get("skipped_position_fetch"):
                await asyncio.sleep(3.0)
            success += 1
        except Exception as e:
            failed += 1
            errors.append(f"{ac.registration}: {str(e)}")
            
    await db.commit()
    return {
        "detail": f"Successfully synced {success} aircraft. {failed} failed.",
        "success_count": success,
        "failed_count": failed,
        "errors": errors
    }


# ------------------------------------------------------------------
# Enroute Live Flight Tracker V2
# ------------------------------------------------------------------

_airports_db = None

def get_airports_db():
    global _airports_db
    if _airports_db is None:
        import airportsdata
        _airports_db = airportsdata.load('ICAO')
    return _airports_db

_telemetry_cache = {}
TELEMETRY_CACHE_TTL = 15.0  # seconds

@router.get("/live/track-booking/{booking_id}")
async def if_track_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve enroute telemetry coordinates, actual route history, and flight plan for a booking."""
    import time
    import math
    from app.core.dependencies import get_current_pilot
    from app.services.if_live_v2_client import IFLiveV2Client
    from app.models.live_models import LiveFlightBooking, LiveFlightSchedule, LiveAircraft, Pilot
    
    now = time.time()
    # Check cache first
    cache_entry = _telemetry_cache.get(booking_id)
    if cache_entry and (now - cache_entry["timestamp"] < TELEMETRY_CACHE_TTL):
        return cache_entry["data"]

    # Load booking
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    booking_result = await db.execute(
        select(LiveFlightBooking)
        .where(LiveFlightBooking.id == booking_id)
        .options(
            selectinload(LiveFlightBooking.schedule)
            .selectinload(LiveFlightSchedule.aircraft)
            .selectinload(LiveAircraft.aircraft_type),
            selectinload(LiveFlightBooking.departure_pilot)
        )
    )
    booking = booking_result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    dep_icao = (booking.schedule.departure or "OTHH").upper()
    arr_icao = (booking.schedule.arrival or "OTHH").upper()

    client = IFLiveV2Client()

    if client.is_mock:
        # Generate fully-functional mock flight tracking telemetry based on dispatched timestamp
        dispatched_at = booking.dispatched_at
        if not dispatched_at:
            dispatched_at = booking.booked_at
            
        import datetime
        # Remove timezone if aware to compare with utcnow
        if dispatched_at.tzinfo is not None:
            dispatched_at = dispatched_at.replace(tzinfo=None)

        elapsed = (datetime.datetime.utcnow() - dispatched_at).total_seconds()
        
        # Assume duration from schedule or default to 1.5 hours (90 minutes)
        duration = (booking.schedule.ground_time_minutes or 90) * 60
        progress = elapsed / duration
        if progress > 1.0:
            progress = 0.99  # Cap at 99% so it remains visible enroute in development
            
        # Get coordinates
        apt_db = get_airports_db()
        dep_apt = apt_db.get(dep_icao, {"lat": 25.273, "lon": 51.564})
        arr_apt = apt_db.get(arr_icao, {"lat": 51.470, "lon": -0.454})
        
        dep_lat, dep_lon = dep_apt["lat"], dep_apt["lon"]
        arr_lat, arr_lon = arr_apt["lat"], arr_apt["lon"]
        
        # Interpolate position
        current_lat = dep_lat + progress * (arr_lat - dep_lat)
        current_lon = dep_lon + progress * (arr_lon - dep_lon)
        
        # Compute heading
        dlon = math.radians(arr_lon - dep_lon)
        lat1 = math.radians(dep_lat)
        lat2 = math.radians(arr_lat)
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        heading = (math.degrees(math.atan2(y, x)) + 360) % 360
        
        # Interpolate flight phase stats
        if progress < 0.15:
            phase_pct = progress / 0.15
            altitude = int(phase_pct * 36000)
            speed = int(160 + phase_pct * 290)
            vs = 2200
            status_text = "Climbing"
        elif progress < 0.85:
            altitude = 36000
            speed = 455
            vs = 0
            status_text = "Cruising"
        else:
            phase_pct = (progress - 0.85) / 0.15
            altitude = int(36000 - phase_pct * 35900)
            speed = int(450 - phase_pct * 310)
            vs = -1800
            status_text = "Descending"
            
        # Generate mock trail coords
        trail = []
        steps = int(progress * 50) + 1
        for i in range(steps):
            p = i / 50.0
            trail.append({
                "latitude": dep_lat + p * (arr_lat - dep_lat),
                "longitude": dep_lon + p * (arr_lon - dep_lon),
                "altitude": 36000 if p > 0.15 and p < 0.85 else (36000 * (p/0.15) if p <= 0.15 else 36000 * (1 - (p-0.85)/0.15)),
                "date": datetime.datetime.utcnow().isoformat() + "Z"
            })
            
        # Generate mock flight plan waypoints
        flight_plan_waypoints = [
            {"name": dep_icao, "latitude": dep_lat, "longitude": dep_lon},
            {"name": "WP-MID1", "latitude": dep_lat + 0.3 * (arr_lat - dep_lat), "longitude": dep_lon + 0.3 * (arr_lon - dep_lon)},
            {"name": "WP-MID2", "latitude": dep_lat + 0.7 * (arr_lat - dep_lat), "longitude": dep_lon + 0.7 * (arr_lon - dep_lon)},
            {"name": arr_icao, "latitude": arr_lat, "longitude": arr_lon}
        ]
        
        aircraft_reg = booking.schedule.aircraft.registration if booking.schedule and booking.schedule.aircraft else None
        aircraft_model = booking.schedule.aircraft.aircraft_type.name if booking.schedule and booking.schedule.aircraft and booking.schedule.aircraft.aircraft_type else None

        telemetry = {
            "active": True,
            "mock": True,
            "flightId": "mock-flight-id",
            "sessionId": "mock-session-id",
            "callsign": booking.schedule.flight_number or "QRV100",
            "username": booking.departure_pilot.ifc or "MockPilot",
            "latitude": current_lat,
            "longitude": current_lon,
            "altitude": altitude,
            "speed": speed,
            "verticalSpeed": vs,
            "heading": heading,
            "track": heading,
            "status": status_text,
            "origin": dep_icao,
            "destination": arr_icao,
            "dep_lat": dep_lat,
            "dep_lon": dep_lon,
            "arr_lat": arr_lat,
            "arr_lon": arr_lon,
            "flownRoute": trail,
            "flightPlan": flight_plan_waypoints,
            "aircraft_reg": aircraft_reg,
            "aircraft_model": aircraft_model
        }
        
        _telemetry_cache[booking_id] = {
            "timestamp": now,
            "data": telemetry
        }
        return telemetry

    # LIVE TELEMETRY MODE
    pilot_ifuserid = booking.departure_pilot.ifuserid
    if not pilot_ifuserid:
        return {
            "active": False,
            "mock": False,
            "message": "Pilot has not linked their Infinite Flight User ID in Settings."
        }

    # Fetch sessions
    sessions = await client.get_sessions()
    matched_flight = None
    matched_session_id = None

    for session in sessions:
        session_id = session["id"]
        flights = await client.get_flights(session_id)
        for f in flights:
            if f.get("userId") == pilot_ifuserid:
                f_id = f.get("flightId")
                fplan = await client.get_flight_plan(session_id, f_id)
                
                fplan_matches = False
                if fplan and fplan.get("flightPlanItems"):
                    items = fplan["flightPlanItems"]
                    item_names = []
                    for item in items:
                        if item.get("name"):
                            item_names.append(item["name"].upper())
                        if item.get("children"):
                            for child in item["children"]:
                                if child.get("name"):
                                    item_names.append(child["name"].upper())
                                    
                    if dep_icao in item_names and arr_icao in item_names:
                        fplan_matches = True
                        
                # Alternative fallback: if callsign matches
                if fplan_matches or (f.get("callsign", "").upper() == (booking.schedule.flight_number or "").replace("-", "").upper()):
                    matched_flight = f
                    matched_session_id = session_id
                    break
        if matched_flight:
            break

    if not matched_flight:
        return {
            "active": False,
            "mock": False,
            "message": "No matching active flight found on Infinite Flight servers."
        }

    f_id = matched_flight["flightId"]
    flown_route_reports = await client.get_flight_route(matched_session_id, f_id)
    fplan_details = await client.get_flight_plan(matched_session_id, f_id)
    
    trail = []
    for r in flown_route_reports:
        trail.append({
            "latitude": r.get("latitude"),
            "longitude": r.get("longitude"),
            "altitude": r.get("altitude"),
            "date": r.get("date")
        })

    flight_plan_waypoints = []
    if fplan_details and fplan_details.get("flightPlanItems"):
        for item in fplan_details["flightPlanItems"]:
            if item.get("children"):
                for child in item["children"]:
                    loc = child.get("location", {})
                    flight_plan_waypoints.append({
                        "name": child.get("name", child.get("identifier")),
                        "latitude": loc.get("latitude", 0),
                        "longitude": loc.get("longitude", 0)
                    })
            else:
                loc = item.get("location", {})
                flight_plan_waypoints.append({
                    "name": item.get("name", item.get("identifier")),
                    "latitude": loc.get("latitude", 0),
                    "longitude": loc.get("longitude", 0)
                })

    apt_db = get_airports_db()
    dep_apt = apt_db.get(dep_icao, {"lat": matched_flight.get("latitude"), "lon": matched_flight.get("longitude")})
    arr_apt = apt_db.get(arr_icao, {"lat": matched_flight.get("latitude"), "lon": matched_flight.get("longitude")})

    alt = matched_flight.get("altitude", 0)
    vs = matched_flight.get("verticalSpeed", 0)
    if alt < 1000:
        status_text = "On the Ground"
    elif vs > 500:
        status_text = "Climbing"
    elif vs < -500:
        status_text = "Descending"
    else:
        status_text = "Cruising"

    aircraft_reg = booking.schedule.aircraft.registration if booking.schedule and booking.schedule.aircraft else None
    aircraft_model = booking.schedule.aircraft.aircraft_type.name if booking.schedule and booking.schedule.aircraft and booking.schedule.aircraft.aircraft_type else None

    telemetry = {
        "active": True,
        "mock": False,
        "flightId": f_id,
        "sessionId": matched_session_id,
        "callsign": matched_flight.get("callsign"),
        "username": matched_flight.get("username"),
        "latitude": matched_flight.get("latitude"),
        "longitude": matched_flight.get("longitude"),
        "altitude": alt,
        "speed": matched_flight.get("speed"),
        "verticalSpeed": vs,
        "heading": matched_flight.get("heading"),
        "track": matched_flight.get("track"),
        "status": status_text,
        "origin": dep_icao,
        "destination": arr_icao,
        "dep_lat": dep_dep_lat if 'dep_dep_lat' in locals() else dep_apt["lat"],
        "dep_lon": dep_dep_lon if 'dep_dep_lon' in locals() else dep_apt["lon"],
        "arr_lat": arr_arr_lat if 'arr_arr_lat' in locals() else arr_apt["lat"],
        "arr_lon": arr_arr_lon if 'arr_arr_lon' in locals() else arr_apt["lon"],
        "flownRoute": trail,
        "flightPlan": flight_plan_waypoints,
        "aircraft_reg": aircraft_reg,
        "aircraft_model": aircraft_model
    }

    _telemetry_cache[booking_id] = {
        "timestamp": now,
        "data": telemetry
    }
    return telemetry
