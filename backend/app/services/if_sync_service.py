from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import LiveAircraft, LiveFlightSchedule, LiveIFOAuthToken
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
