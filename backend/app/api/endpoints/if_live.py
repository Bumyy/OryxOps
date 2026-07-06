from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_staff
from app.models.live_models import LiveFlightSchedule, Pilot
from app.services.if_live_client import IFLiveClient, IFTokenManager
from app.services.if_sync_service import IFScheduleSync

router = APIRouter(prefix="/infinite-flight", tags=["infinite-flight"])

_manager = IFTokenManager()


async def _get_if_client(db: AsyncSession, pilot: Pilot) -> IFLiveClient:
    client = await _manager.get_client(db, pilot.id)
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
