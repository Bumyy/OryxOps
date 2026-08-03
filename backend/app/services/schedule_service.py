import asyncio
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import (
    LiveAircraft,
    LiveFlightBooking,
    LiveFlightSchedule,
    LiveGroupAircraft,
    LiveScheduleWave,
    Route,
    Pilot,
)
from app.services.discord_service import (
    send_staff_proposal_webhook,
    send_pilot_approval_webhook,
)

# ── IN-MEMORY NOTIFICATION QUEUE STATE ──
_pending_proposals: dict[int, set[int]] = {}  # pilot_id -> set of schedule_ids
_pending_proposal_timers: dict[int, asyncio.Task] = {}

_pending_approvals: set[int] = set()  # set of schedule_ids
_pending_approval_timer: asyncio.Task | None = None


def queue_proposal_notification(pilot_id: int, schedule_id: int):
    if pilot_id not in _pending_proposals:
        _pending_proposals[pilot_id] = set()
    _pending_proposals[pilot_id].add(schedule_id)
    if pilot_id not in _pending_proposal_timers or _pending_proposal_timers[pilot_id].done():
        _pending_proposal_timers[pilot_id] = asyncio.create_task(_auto_flush_proposals_after_delay(pilot_id, 300))


def queue_approval_notification(schedule_id: int, pilot_id: int | None = None):
    if pilot_id and pilot_id in _pending_proposals:
        _pending_proposals[pilot_id].discard(schedule_id)
    _pending_approvals.add(schedule_id)
    global _pending_approval_timer
    if _pending_approval_timer is None or _pending_approval_timer.done():
        _pending_approval_timer = asyncio.create_task(_auto_flush_approvals_after_delay(300))


async def _auto_flush_proposals_after_delay(pilot_id: int, delay_seconds: int = 300):
    await asyncio.sleep(delay_seconds)
    if pilot_id in _pending_proposals and _pending_proposals[pilot_id]:
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await flush_staff_proposal_notification(db, pilot_id)


async def _auto_flush_approvals_after_delay(delay_seconds: int = 300):
    await asyncio.sleep(delay_seconds)
    if _pending_approvals:
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await flush_pilot_approval_notifications(db)


async def flush_staff_proposal_notification(db: AsyncSession, pilot_id: int) -> int:
    schedule_ids = list(_pending_proposals.pop(pilot_id, set()))
    if not schedule_ids:
        return 0

    task = _pending_proposal_timers.pop(pilot_id, None)
    if task and not task.done():
        task.cancel()

    pilot_res = await db.execute(select(Pilot).where(Pilot.id == pilot_id))
    pilot = pilot_res.scalar_one_or_none()
    if not pilot:
        return 0

    stmt = (
        select(LiveFlightSchedule)
        .where(LiveFlightSchedule.id.in_(schedule_ids))
        .options(
            selectinload(LiveFlightSchedule.aircraft).selectinload(LiveAircraft.aircraft_type),
            selectinload(LiveFlightSchedule.group),
        )
    )
    res = await db.execute(stmt)
    schedules = list(res.scalars().all())

    if schedules:
        await send_staff_proposal_webhook(db, pilot, schedules)

    return len(schedules)


async def flush_pilot_approval_notifications(db: AsyncSession) -> int:
    global _pending_approvals, _pending_approval_timer
    schedule_ids = list(_pending_approvals)
    _pending_approvals.clear()

    if _pending_approval_timer and not _pending_approval_timer.done():
        _pending_approval_timer.cancel()
    _pending_approval_timer = None

    if not schedule_ids:
        return 0

    stmt = (
        select(LiveFlightSchedule)
        .where(LiveFlightSchedule.id.in_(schedule_ids))
        .options(
            selectinload(LiveFlightSchedule.aircraft).selectinload(LiveAircraft.aircraft_type),
            selectinload(LiveFlightSchedule.group),
        )
    )
    res = await db.execute(stmt)
    schedules = list(res.scalars().all())

    by_pilot: dict[int, list[LiveFlightSchedule]] = {}
    for s in schedules:
        if s.created_by:
            by_pilot.setdefault(s.created_by, []).append(s)

    total_count = 0
    for pilot_id, p_schedules in by_pilot.items():
        p_res = await db.execute(select(Pilot).where(Pilot.id == pilot_id))
        pilot = p_res.scalar_one_or_none()
        if pilot and p_schedules:
            await send_pilot_approval_webhook(db, pilot, p_schedules)
            total_count += len(p_schedules)

    return total_count


def get_pending_notification_counts(pilot_id: int, is_staff: bool) -> dict[str, int]:
    return {
        "pending_proposals": len(_pending_proposals.get(pilot_id, set())),
        "pending_approvals": len(_pending_approvals) if is_staff else 0,
    }


async def get_schedules(
    db: AsyncSession,
    group_id: int | None = None,
    week_start: str | None = None,
    status: str | None = None,
) -> list[LiveFlightSchedule]:
    query = select(LiveFlightSchedule).options(
        selectinload(LiveFlightSchedule.aircraft),
        selectinload(LiveFlightSchedule.wave),
        selectinload(LiveFlightSchedule.route),
        selectinload(LiveFlightSchedule.creator),
    )

    if group_id:
        query = query.where(LiveFlightSchedule.group_id == group_id)
    if week_start:
        query = query.where(LiveFlightSchedule.week_start == week_start)
    if status:
        if status == "all":
            pass
        else:
            query = query.where(LiveFlightSchedule.status == status)
    else:
        # Exclude draft unless explicitly requested
        query = query.where(LiveFlightSchedule.status != "draft")

    query = query.order_by(LiveFlightSchedule.scheduled_departure.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_schedule(db: AsyncSession, schedule_id: int) -> LiveFlightSchedule | None:
    result = await db.execute(
        select(LiveFlightSchedule)
        .where(LiveFlightSchedule.id == schedule_id)
        .options(
            selectinload(LiveFlightSchedule.aircraft),
            selectinload(LiveFlightSchedule.wave),
            selectinload(LiveFlightSchedule.route),
            selectinload(LiveFlightSchedule.creator),
        )
    )
    return result.scalar_one_or_none()


async def create_schedule(db: AsyncSession, data: dict) -> LiveFlightSchedule:
    schedule = LiveFlightSchedule(**data)
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


async def update_schedule(
    db: AsyncSession, schedule_id: int, data: dict
) -> LiveFlightSchedule | None:
    result = await db.execute(
        select(LiveFlightSchedule).where(LiveFlightSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(schedule, key, value)
    await db.commit()
    await db.refresh(schedule)
    return schedule


async def delete_schedule(db: AsyncSession, schedule_id: int) -> bool:
    result = await db.execute(
        select(LiveFlightSchedule).where(LiveFlightSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        return False
    schedule.status = "cancelled"
    
    # Cancel all active bookings on this schedule
    await db.execute(
        update(LiveFlightBooking)
        .where(LiveFlightBooking.schedule_id == schedule_id)
        .where(LiveFlightBooking.status.in_(["booked", "dispatched"]))
        .values(status="cancelled")
    )
    
    # Refund any consumed purchased proposal token back to the pilot's account (set reference_id to 0)
    from app.models.live_models import LiveCurrencyTransaction
    await db.execute(
        update(LiveCurrencyTransaction)
        .where(
            LiveCurrencyTransaction.transaction_type == "extra_proposal_slot",
            LiveCurrencyTransaction.reference_id == schedule_id
        )
        .values(
            reference_id=0,
            description="Refunded proposal token (flight deleted/cancelled)"
        )
    )
    
    await db.commit()
    return True


async def get_pilot_proposal_quota(
    db: AsyncSession, pilot_id: int, week_start: str
) -> dict:
    from sqlalchemy import func
    from app.models.live_models import LivePilotCareer, LiveCareerRank, LiveCurrencyTransaction

    career_res = await db.execute(
        select(LivePilotCareer)
        .where(LivePilotCareer.pilot_id == pilot_id)
        .options(selectinload(LivePilotCareer.current_rank))
    )
    career = career_res.scalar_one_or_none()
    weekly_limit = 3
    if career and career.current_rank:
        weekly_limit = career.current_rank.weekly_proposal_limit or 3

    count_res = await db.execute(
        select(func.count(LiveFlightSchedule.id)).where(
            LiveFlightSchedule.created_by == pilot_id,
            LiveFlightSchedule.week_start == week_start,
            LiveFlightSchedule.status != "cancelled",
        )
    )
    proposals_used = count_res.scalar() or 0

    # Query for unused short-haul tokens (-1000)
    short_tokens_res = await db.execute(
        select(func.count(LiveCurrencyTransaction.id)).where(
            LiveCurrencyTransaction.pilot_id == pilot_id,
            LiveCurrencyTransaction.transaction_type == "extra_proposal_slot",
            LiveCurrencyTransaction.amount == -1000,
            (LiveCurrencyTransaction.reference_id.is_(None)) | (LiveCurrencyTransaction.reference_id == 0)
        )
    )
    purchased_short_slots = short_tokens_res.scalar() or 0

    # Query for unused long-haul tokens (-2000)
    long_tokens_res = await db.execute(
        select(func.count(LiveCurrencyTransaction.id)).where(
            LiveCurrencyTransaction.pilot_id == pilot_id,
            LiveCurrencyTransaction.transaction_type == "extra_proposal_slot",
            LiveCurrencyTransaction.amount == -2000,
            (LiveCurrencyTransaction.reference_id.is_(None)) | (LiveCurrencyTransaction.reference_id == 0)
        )
    )
    purchased_long_slots = long_tokens_res.scalar() or 0

    return {
        "weekly_limit": weekly_limit,
        "proposals_used": proposals_used,
        "remaining_free_slots": max(0, weekly_limit - proposals_used),
        "purchased_short_slots": purchased_short_slots,
        "purchased_long_slots": purchased_long_slots,
        "extra_slot_fee_short_haul": 1000,
        "extra_slot_fee_long_haul": 2000,
    }


async def check_and_process_proposal_slot(
    db: AsyncSession, pilot_id: int, week_start: Any, schedule: LiveFlightSchedule
) -> int:
    from sqlalchemy import func
    from app.models.live_models import (
        LivePilotCareer,
        LiveCurrency,
        LiveCurrencyTransaction,
    )

    career_res = await db.execute(
        select(LivePilotCareer)
        .where(LivePilotCareer.pilot_id == pilot_id)
        .options(selectinload(LivePilotCareer.current_rank))
    )
    career = career_res.scalar_one_or_none()
    if not career or not career.selected_aircraft_ids:
        raise ValueError(
            "Configuration Required: You cannot propose flights until your Career Path (Airbus/Boeing) and 2 Aircraft selection are configured by staff."
        )

    weekly_limit = 3
    if career and career.current_rank:
        weekly_limit = career.current_rank.weekly_proposal_limit or 3

    count_res = await db.execute(
        select(func.count(LiveFlightSchedule.id)).where(
            LiveFlightSchedule.created_by == pilot_id,
            LiveFlightSchedule.week_start == week_start,
            LiveFlightSchedule.status != "cancelled",
            LiveFlightSchedule.id != schedule.id,
        )
    )
    proposals_used = count_res.scalar() or 0

    if proposals_used < weekly_limit:
        schedule.proposal_cost_qar = 0
        return 0

    duration_hours = 0.0
    if schedule.scheduled_departure and schedule.scheduled_arrival:
        diff = schedule.scheduled_arrival - schedule.scheduled_departure
        duration_hours = diff.total_seconds() / 3600.0
    elif schedule.route and schedule.route.duration:
        duration_hours = schedule.route.duration / 3600.0

    cost = 1000 if duration_hours < 8.0 else 2000
    slot_label = "Short" if duration_hours < 8.0 else "Long"

    # Look for an unused pre-purchased slot transaction of matching cost
    unused_tx_res = await db.execute(
        select(LiveCurrencyTransaction)
        .where(
            LiveCurrencyTransaction.pilot_id == pilot_id,
            LiveCurrencyTransaction.transaction_type == "extra_proposal_slot",
            LiveCurrencyTransaction.amount == -cost,
            (LiveCurrencyTransaction.reference_id.is_(None)) | (LiveCurrencyTransaction.reference_id == 0)
        )
        .order_by(LiveCurrencyTransaction.created_at.asc())
        .limit(1)
    )
    unused_tx = unused_tx_res.scalar_one_or_none()

    if unused_tx:
        # Consume the token: link it to the schedule ID and update description
        unused_tx.reference_id = schedule.id
        unused_tx.description = f"Pre-purchased slot consumed for flight #{schedule.id} ({duration_hours:.1f}h flight)"
        schedule.proposal_cost_qar = 0
        return 0

    # If no token is available, block proposal and require shop purchase
    raise ValueError(
        f"Weekly rank proposal limit ({weekly_limit}) reached. "
        f"You must purchase a {slot_label}-Haul Proposal Token in the Shop to propose this flight."
    )


async def update_schedule_status(
    db: AsyncSession, schedule_id: int, status: str, approved_by: int | None = None, pilot_id: int | None = None
) -> LiveFlightSchedule | None:
    schedule = await get_schedule(db, schedule_id)
    if not schedule:
        return None
    if status == "proposed" and schedule.status != "proposed":
        effective_pilot_id = pilot_id or schedule.created_by
        if effective_pilot_id:
            await check_and_process_proposal_slot(db, effective_pilot_id, schedule.week_start, schedule)
            queue_proposal_notification(effective_pilot_id, schedule.id)

    if status == "approved" and schedule.status != "approved":
        queue_approval_notification(schedule.id, schedule.created_by)

    # Refund token if moving from proposed/approved back to draft (rejection)
    if status == "draft" and schedule.status in ["proposed", "approved"]:
        from app.models.live_models import LiveCurrencyTransaction
        await db.execute(
            update(LiveCurrencyTransaction)
            .where(
                LiveCurrencyTransaction.transaction_type == "extra_proposal_slot",
                LiveCurrencyTransaction.reference_id == schedule_id
            )
            .values(
                reference_id=0,
                description="Refunded proposal token (flight rejected/drafted)"
            )
        )

    schedule.status = status
    if approved_by:
        schedule.approved_by = approved_by
    await db.commit()
    await db.refresh(schedule)
    return schedule


async def bulk_approve_schedules(
    db: AsyncSession, group_id: int, week_start: str, approved_by: int
) -> int:
    result = await db.execute(
        select(LiveFlightSchedule).where(
            LiveFlightSchedule.group_id == group_id,
            LiveFlightSchedule.week_start == week_start,
            LiveFlightSchedule.status == "proposed",
        )
    )
    schedules = list(result.scalars().all())
    count = 0
    for schedule in schedules:
        schedule.status = "approved"
        schedule.approved_by = approved_by
        queue_approval_notification(schedule.id, schedule.created_by)
        count += 1
    await db.commit()
    return count


async def get_waves(
    db: AsyncSession, group_id: int | None = None, week_start: str | None = None
) -> list[LiveScheduleWave]:
    query = select(LiveScheduleWave)
    if group_id:
        query = query.where(LiveScheduleWave.group_id == group_id)
    if week_start:
        query = query.where(LiveScheduleWave.week_start == week_start)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_wave(db: AsyncSession, data: dict) -> LiveScheduleWave:
    wave = LiveScheduleWave(**data)
    db.add(wave)
    await db.commit()
    await db.refresh(wave)
    return wave


async def delete_wave(db: AsyncSession, wave_id: int) -> bool:
    result = await db.execute(
        select(LiveScheduleWave).where(LiveScheduleWave.id == wave_id)
    )
    wave = result.scalar_one_or_none()
    if not wave:
        return False
    await db.delete(wave)
    await db.commit()
    return True


async def get_available_aircraft_for_schedule(
    db: AsyncSession, group_id: int
) -> list[LiveAircraft]:
    result = await db.execute(
        select(LiveAircraft)
        .join(LiveGroupAircraft, LiveGroupAircraft.aircraft_id == LiveAircraft.id)
        .where(
            LiveGroupAircraft.group_id == group_id,
            LiveGroupAircraft.removed_at.is_(None),
            LiveAircraft.status.in_(["parked", "in_hangar"]),
        )
        .options(selectinload(LiveAircraft.aircraft_type))
    )
    return list(result.scalars().all())


async def get_schedule_booking_count(db: AsyncSession, schedule_id: int) -> int:
    from sqlalchemy import func

    result = await db.execute(
        select(func.count(LiveFlightBooking.id)).where(
            LiveFlightBooking.schedule_id == schedule_id,
            LiveFlightBooking.status.in_(["booked", "completed"]),
        )
    )
    return result.scalar() or 0


async def generate_auto_schedules(
    db: AsyncSession,
    group_id: int,
    aircraft_id: int,
    num_roundtrips: int,
    haul_preference: str,
    start_time_str: str,
    creator_id: int,
    min_hours: int | None = 0,
    max_hours: int | None = 0,
) -> int:
    import random
    from app.models.live_models import RouteAircraft, Route

    # 1. Fetch specified aircraft
    aircraft_result = await db.execute(
        select(LiveAircraft)
        .where(LiveAircraft.id == aircraft_id)
        .options(selectinload(LiveAircraft.aircraft_type))
    )
    ac = aircraft_result.scalar_one_or_none()
    if not ac:
        raise ValueError("Selected aircraft not found.")

    # 2. Parse start_time string to datetime object
    try:
        start_time_str_parsed = start_time_str.replace("Z", "").replace(" ", "T")
        if len(start_time_str_parsed) == 16:  # "YYYY-MM-DDTHH:MM"
            start_time = datetime.strptime(start_time_str_parsed, "%Y-%m-%dT%H:%M")
        else:
            start_time = datetime.fromisoformat(start_time_str_parsed)
    except Exception:
        raise ValueError("Invalid start_time format. Must be a valid ISO datetime (e.g. YYYY-MM-DDTHH:MM).")

    # 3. Find candidate routes for this aircraft type departing from/arriving at OTHH
    ac_type_id = ac.aircraft_type_id
    outbound_result = await db.execute(
        select(Route)
        .join(RouteAircraft, RouteAircraft.routeid == Route.id)
        .where(
            RouteAircraft.aircraftid == ac_type_id,
            Route.dep == "OTHH"
        )
    )
    outbound_routes = list(outbound_result.scalars().all())
    
    inbound_result = await db.execute(
        select(Route)
        .join(RouteAircraft, RouteAircraft.routeid == Route.id)
        .where(
            RouteAircraft.aircraftid == ac_type_id,
            Route.arr == "OTHH"
        )
    )
    inbound_routes = list(inbound_result.scalars().all())
    
    # Create round-trip pairs (matching outbound.arr == inbound.dep)
    route_pairs = []
    for out_r in outbound_routes:
        matches = [in_r for in_r in inbound_routes if in_r.dep == out_r.arr]
        if matches:
            route_pairs.append((out_r, matches[0]))
    
    if not route_pairs:
        raise ValueError(f"No certified round-trip routes found from OTHH for aircraft type {ac.aircraft_type.name if ac.aircraft_type else 'unknown'}.")

    # 4. Apply custom flight duration filters
    if min_hours is not None and min_hours > 0:
        route_pairs = [p for p in route_pairs if p[0].duration >= min_hours * 3600]
    if max_hours is not None and max_hours > 0:
        route_pairs = [p for p in route_pairs if p[0].duration <= max_hours * 3600]

    if not route_pairs:
        raise ValueError(
            f"No round-trip routes found for aircraft type {ac.aircraft_type.name if ac.aircraft_type else 'unknown'} "
            f"matching the custom duration constraint (Min: {min_hours or 0}h, Max: {max_hours or 0}h)."
        )
        
    # 5. Filter route pairs based on haul preference (threshold: 3 hours = 10800 seconds)
    short_pairs = [p for p in route_pairs if p[0].duration <= 10800]
    long_pairs = [p for p in route_pairs if p[0].duration > 10800]
    
    selected_pairs = []
    if haul_preference == "short":
        pool = short_pairs if short_pairs else route_pairs
        selected_pairs = [random.choice(pool) for _ in range(num_roundtrips)] if pool else []
    elif haul_preference == "long":
        pool = long_pairs if long_pairs else route_pairs
        selected_pairs = [random.choice(pool) for _ in range(num_roundtrips)] if pool else []
    else:  # mixed
        half = num_roundtrips // 2
        remainder = num_roundtrips - half
        
        selected_short = []
        selected_long = []
        
        if short_pairs:
            selected_short = [random.choice(short_pairs) for _ in range(remainder)]
        if long_pairs:
            selected_long = [random.choice(long_pairs) for _ in range(half)]
            
        if not selected_short and selected_long:
            selected_short = [random.choice(long_pairs) for _ in range(remainder)]
        if not selected_long and selected_short:
            selected_long = [random.choice(short_pairs) for _ in range(half)]
            
        selected_pairs = selected_short + selected_long
        if not selected_pairs:
            selected_pairs = [random.choice(route_pairs) for _ in range(num_roundtrips)]
            
    # 6. Generate schedule records spaced 2 days apart starting from start_time
    total_created = 0
    for idx in range(num_roundtrips):
        if idx >= len(selected_pairs):
            break
            
        outbound, inbound = selected_pairs[idx]
        
        trip_start_time = start_time + timedelta(days=idx * 2)
        outbound_dep_time = trip_start_time
        outbound_arr_time = outbound_dep_time + timedelta(seconds=outbound.duration)
        
        # Calculate correct week_start for this specific trip
        trip_date = trip_start_time.date()
        trip_week_start = trip_date - timedelta(days=trip_date.weekday())
        
        # Ground time: 60 minutes
        ground_time = 60
        inbound_dep_time = outbound_arr_time + timedelta(minutes=ground_time)
        inbound_arr_time = inbound_dep_time + timedelta(seconds=inbound.duration)
        
        # Create outbound flight leg (saved as draft)
        outbound_leg = LiveFlightSchedule(
            group_id=group_id,
            aircraft_id=ac.id,
            route_id=outbound.id,
            departure=outbound.dep,
            arrival=outbound.arr,
            flight_number=outbound.fltnum.split(",")[0].strip() if outbound.fltnum else "QR1",
            scheduled_departure=outbound_dep_time,
            scheduled_arrival=outbound_arr_time,
            ground_time_minutes=ground_time,
            status="draft",
            created_by=creator_id,
            week_start=trip_week_start
        )
        db.add(outbound_leg)
        
        # Create inbound flight leg (saved as draft)
        inbound_leg = LiveFlightSchedule(
            group_id=group_id,
            aircraft_id=ac.id,
            route_id=inbound.id,
            departure=inbound.dep,
            arrival=inbound.arr,
            flight_number=inbound.fltnum.split(",")[0].strip() if inbound.fltnum else "QR2",
            scheduled_departure=inbound_dep_time,
            scheduled_arrival=inbound_arr_time,
            ground_time_minutes=60,
            status="draft",
            created_by=creator_id,
            week_start=trip_week_start
        )
        db.add(inbound_leg)
        
        total_created += 2

    await db.commit()
    return total_created

    await db.commit()
    return total_created
