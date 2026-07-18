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
