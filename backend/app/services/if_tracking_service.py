import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import (
    LiveAircraft,
    LiveFlightBooking,
    LiveFlightSchedule,
    LiveIFOAuthToken,
    Pilot,
)
from app.services.if_live_client import IFLiveClient, IFTokenManager
from app.services.if_v2_client import (
    IFV2Client,
    FlightEntry,
    haversine_distance,
)

logger = logging.getLogger("uvicorn")

_NO_SHOW_GRACE_MINUTES = 30


class IFTrackingSync:
    """Periodically polls IF v2/v3 APIs to:
    1. Auto-dispatch booked schedules by matching v3 aircraft position.id to v2 FlightEntry.flightId
    2. Track in-progress flights (position, progress %, ETA)
    3. Detect no-shows and auto-release bookings for other pilots to claim
    """

    def __init__(self):
        self._last_sync_at: datetime | None = None
        self._active_flight_count: int = 0
        self._dispatched_count: int = 0
        self._no_show_count: int = 0
        self._error: str | None = None

    @property
    def status(self) -> dict:
        return {
            "last_sync_at": str(self._last_sync_at) if self._last_sync_at else None,
            "active_flights_on_server": self._active_flight_count,
            "dispatched_this_cycle": self._dispatched_count,
            "no_shows_this_cycle": self._no_show_count,
            "last_error": self._error,
        }

    async def sync(self, db: AsyncSession) -> dict:
        self._dispatched_count = 0
        self._no_show_count = 0
        self._error = None
        now = datetime.utcnow()

        try:
            async with IFV2Client() as v2:
                expert = await v2.get_expert_session()
                if expert is None:
                    self._error = "No Expert server found"
                    self._last_sync_at = now
                    return self.status

                flights = await v2.list_session_flights(expert.id)
                self._active_flight_count = len(flights)

                flight_by_id: dict[str, FlightEntry] = {f.flight_id: f for f in flights}
                session_id = expert.id

                due_booked = await self._get_due_booked_schedules(db, now)
                dispatched = await self._get_dispatched_bookings(db)

                v3_client = await self._get_v3_client(db)

                # --- Auto-dispatch: v3 position.id ∈ v2 flightId set ---
                for booking in due_booked:
                    schedule = booking.schedule
                    if schedule is None:
                        continue
                    aircraft = schedule.aircraft
                    if aircraft is None or not aircraft.if_organization_aircraft_id:
                        continue

                    matched_flight = None
                    if v3_client is not None:
                        try:
                            pos = await v3_client.get_aircraft_position(
                                aircraft.if_organization_aircraft_id
                            )
                            pos_id = pos.get("id") if isinstance(pos, dict) else None
                            if pos_id and pos_id in flight_by_id:
                                matched_flight = flight_by_id[pos_id]
                        except Exception:
                            pass

                    if matched_flight:
                        valid = await self._validate_booking_pilot(
                            db, booking, matched_flight
                        )
                        if not valid:
                            continue
                        if matched_flight.speed <= 0:
                            continue
                        await self._auto_dispatch(
                            db, booking, schedule, matched_flight, now
                        )
                        self._dispatched_count += 1
                        continue

                    # --- No-show detection (DISABLED) ---
                    # cutoff = schedule.scheduled_departure + timedelta(
                    #     minutes=_NO_SHOW_GRACE_MINUTES
                    # )
                    # if schedule.scheduled_departure and now >= cutoff:
                    #     await self._auto_no_show(db, booking, now)
                    #     self._no_show_count += 1
                    pass

                # --- Track dispatched flights ---
                for booking in dispatched:
                    schedule = booking.schedule
                    if schedule is None:
                        continue
                    if booking.if_flight_id and booking.if_flight_id in flight_by_id:
                        if schedule.actual_departure is None:
                            schedule.actual_departure = now
                            db.add(schedule)
                        schedule.if_session_id = session_id
                        db.add(schedule)
                    elif booking.if_flight_id and booking.if_flight_id not in flight_by_id:
                        if schedule.scheduled_arrival and now >= schedule.scheduled_arrival:
                            if schedule.actual_arrival is None:
                                schedule.actual_arrival = now
                                db.add(schedule)

                if v3_client is not None:
                    await v3_client.close()

                await db.commit()
                self._last_sync_at = now

        except Exception as exc:
            self._error = str(exc)
            logger.error(f"IF tracking sync failed: {exc}")

        return self.status

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_v3_client(self, db: AsyncSession) -> IFLiveClient | None:
        """Get a v3 OAuth client using any available staff token."""
        try:
            result = await db.execute(
                select(LiveIFOAuthToken)
                .where(LiveIFOAuthToken.refresh_token != "")
                .where(LiveIFOAuthToken.refresh_token.isnot(None))
            )
            token_row = result.scalars().first()
            if token_row is None:
                return None
            manager = IFTokenManager()
            client = await manager.get_client(db, token_row.pilot_id)
            await client.open()
            return client
        except Exception:
            return None

    async def _get_due_booked_schedules(
        self, db: AsyncSession, now: datetime
    ) -> list[LiveFlightBooking]:
        result = await db.execute(
            select(LiveFlightBooking)
            .join(LiveFlightSchedule)
            .where(
                LiveFlightSchedule.status == "approved",
                LiveFlightSchedule.scheduled_departure <= now,
                LiveFlightBooking.status.in_(["booked"]),
            )
            .options(
                selectinload(LiveFlightBooking.schedule).selectinload(
                    LiveFlightSchedule.aircraft
                ),
            )
        )
        return list(result.scalars().all())

    async def _get_dispatched_bookings(
        self, db: AsyncSession
    ) -> list[LiveFlightBooking]:
        result = await db.execute(
            select(LiveFlightBooking)
            .join(LiveFlightSchedule)
            .where(
                LiveFlightSchedule.status == "approved",
                LiveFlightBooking.status == "dispatched",
            )
            .options(
                selectinload(LiveFlightBooking.schedule).selectinload(
                    LiveFlightSchedule.aircraft
                ),
            )
        )
        return list(result.scalars().all())

    async def _validate_booking_pilot(
        self,
        db: AsyncSession,
        booking: LiveFlightBooking,
        flight: FlightEntry,
    ) -> bool:
        pilot_ids = [
            pid for pid in (booking.departure_pilot_id, booking.arrival_pilot_id)
            if pid is not None
        ]
        if not pilot_ids:
            return False

        result = await db.execute(
            select(Pilot.ifuserid).where(Pilot.id.in_(pilot_ids))
        )
        pilot_if_ids = {row[0] for row in result.all() if row[0]}

        return flight.user_id in pilot_if_ids

    async def _auto_dispatch(
        self,
        db: AsyncSession,
        booking: LiveFlightBooking,
        schedule: LiveFlightSchedule,
        flight: FlightEntry,
        now: datetime,
    ):
        booking.status = "dispatched"
        booking.dispatched_at = now
        booking.if_flight_id = flight.flight_id
        if schedule.actual_departure is None:
            schedule.actual_departure = now
        db.add(booking)
        db.add(schedule)

    # async def _auto_no_show(
    #     self,
    #     db: AsyncSession,
    #     booking: LiveFlightBooking,
    #     now: datetime,
    # ):
    #     booking.status = "no_show"
    #     booking.released_at = now
    #     db.add(booking)


# ---------------------------------------------------------------------------
# Flight progress calculation
# ---------------------------------------------------------------------------

async def get_flight_progress(db: AsyncSession, booking_id: int) -> dict | None:
    result = await db.execute(
        select(LiveFlightBooking)
        .where(LiveFlightBooking.id == booking_id)
        .options(
            selectinload(LiveFlightBooking.schedule).selectinload(
                LiveFlightSchedule.aircraft
            ),
        )
    )
    booking = result.scalar_one_or_none()
    if not booking or not booking.if_flight_id:
        return None

    schedule = booking.schedule
    if not schedule or not schedule.departure or not schedule.arrival:
        return None

    try:
        async with IFV2Client() as v2:
            expert = await v2.get_expert_session()
            if expert is None:
                return None
            flights = await v2.list_session_flights(expert.id)
    except Exception:
        return None

    match = next((f for f in flights if f.flight_id == booking.if_flight_id), None)
    if match is None:
        return {
            "booking_id": booking_id,
            "status": booking.status,
            "in_progress": False,
            "active_on_server": False,
            "latitude": None,
            "longitude": None,
            "altitude": None,
            "speed": None,
            "heading": None,
            "vertical_speed": None,
            "progress_pct": None,
            "eta_minutes": None,
            "distance_remaining_nm": None,
            "on_ground": None,
            "last_report": None,
        }

    from app.services.if_sync_service import airports_db

    origin = airports_db.get(schedule.departure.strip().upper())
    destination = airports_db.get(schedule.arrival.strip().upper())

    origin_lat = origin["lat"] if origin else None
    origin_lon = origin["lon"] if origin else None
    dest_lat = destination["lat"] if destination else None
    dest_lon = destination["lon"] if destination else None

    total_dist_nm = None
    dist_remaining_nm = None
    progress_pct = None
    eta_minutes = None

    if origin_lat is not None and dest_lat is not None:
        total_dist_nm = haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)
        dist_remaining_nm = haversine_distance(
            match.latitude, match.longitude, dest_lat, dest_lon
        )
        if total_dist_nm > 0:
            dist_flown = haversine_distance(
                origin_lat, origin_lon, match.latitude, match.longitude
            )
            progress_pct = round(min(dist_flown / total_dist_nm * 100, 100), 1)
            if match.speed > 0:
                eta_minutes = round(dist_remaining_nm / match.speed * 60)

    return {
        "booking_id": booking_id,
        "status": booking.status,
        "in_progress": True,
        "active_on_server": True,
        "latitude": match.latitude,
        "longitude": match.longitude,
        "altitude": match.altitude,
        "speed": match.speed,
        "heading": match.heading,
        "vertical_speed": match.vertical_speed,
        "progress_pct": progress_pct,
        "eta_minutes": eta_minutes,
        "distance_remaining_nm": round(dist_remaining_nm, 1) if dist_remaining_nm else None,
        "total_distance_nm": round(total_dist_nm, 1) if total_dist_nm else None,
        "on_ground": match.altitude < 100 and match.speed < 50,
        "last_report": match.last_report,
        "callsign": match.callsign,
    }


# ---------------------------------------------------------------------------
# Helper: scan for flights that may have completed
# ---------------------------------------------------------------------------

async def check_completed_flights(db: AsyncSession) -> list[int]:
    now = datetime.utcnow()
    result = await db.execute(
        select(LiveFlightBooking)
        .join(LiveFlightSchedule)
        .where(
            LiveFlightSchedule.status == "approved",
            LiveFlightBooking.status == "dispatched",
            LiveFlightBooking.if_flight_id.isnot(None),
            LiveFlightSchedule.scheduled_arrival <= now,
        )
        .options(
            selectinload(LiveFlightBooking.schedule).selectinload(LiveFlightSchedule.aircraft),
        )
    )
    candidates = result.scalars().all()

    try:
        async with IFV2Client() as v2:
            expert = await v2.get_expert_session()
            if expert is None:
                return []
            flights = await v2.list_session_flights(expert.id)
    except Exception:
        return []

    active_ids = {f.flight_id for f in flights}
    completed_ids: list[int] = []

    for booking in candidates:
        if booking.if_flight_id and booking.if_flight_id not in active_ids:
            schedule = booking.schedule
            if schedule:
                if schedule.actual_arrival is None:
                    schedule.actual_arrival = now
                    db.add(schedule)
                if schedule.aircraft:
                    arrival_airport = (schedule.arrival or "OTHH").strip().upper()
                    if schedule.aircraft.current_airport != arrival_airport:
                        schedule.aircraft.last_airport = schedule.aircraft.current_airport
                    schedule.aircraft.current_airport = arrival_airport
                    schedule.aircraft.status = "parked"
                    db.add(schedule.aircraft)
            completed_ids.append(booking.id)

    await db.commit()
    return completed_ids


tracker = IFTrackingSync()
