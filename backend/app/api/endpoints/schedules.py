from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import Pilot
from app.schemas.schedule import (
    ScheduleBulkApprove,
    ScheduleCreate,
    ScheduleOut,
    ScheduleUpdate,
    WaveCreate,
    WaveOut,
)
from app.services.schedule_service import (
    bulk_approve_schedules,
    create_schedule,
    create_wave,
    delete_schedule,
    delete_wave,
    get_schedule,
    get_schedule_booking_count,
    get_schedules,
    get_waves,
    update_schedule,
    update_schedule_status,
)
from app.services.if_sync_service import IFScheduleSync, try_auto_sync_to_if
from app.services.if_live_client import IFTokenManager

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("", response_model=list[ScheduleOut])
async def list_schedules(
    group_id: int | None = Query(None),
    week_start: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    schedules = await get_schedules(db, group_id, week_start, status)
    return [
        ScheduleOut(
            id=s.id,
            group_id=s.group_id,
            aircraft_id=s.aircraft_id,
            aircraft_registration=s.aircraft.registration if s.aircraft else None,
            route_id=s.route_id,
            departure=s.departure,
            arrival=s.arrival,
            flight_number=s.flight_number,
            scheduled_departure=str(s.scheduled_departure),
            scheduled_arrival=str(s.scheduled_arrival),
            wave_id=s.wave_id,
            wave_name=s.wave.name if s.wave else None,
            ground_time_minutes=s.ground_time_minutes or 60,
            status=s.status,
            created_by=s.created_by,
            created_by_name=s.creator.callsign if s.creator else None,
            approved_by=s.approved_by,
            week_start=str(s.week_start),
            booking_count=await get_schedule_booking_count(db, s.id),
        )
        for s in schedules
    ]


async def check_group_access(db: AsyncSession, group_id: int, pilot: Pilot):
    from app.services.group_service import get_group_members
    from app.models.live_models import StaffRole, Permission

    # Check if pilot is member of group
    members = await get_group_members(db, group_id)
    if pilot.id in [m.pilot_id for m in members]:
        return

    # Check if pilot is staff/admin via Permission table
    perm_result = await db.execute(
        select(Permission).where(
            Permission.userid == pilot.id,
            Permission.name.in_(["admin", "opsmanage"]),
        ).limit(1)
    )
    if perm_result.scalar_one_or_none() is not None:
        return

    # Check if pilot is staff/admin via StaffRole table
    staff_result = await db.execute(
        select(StaffRole).where(StaffRole.user_id == pilot.id).limit(1)
    )
    if staff_result.scalar_one_or_none() is not None:
        return

    raise HTTPException(status_code=403, detail="Not authorized for this group's operations")


@router.post("", response_model=ScheduleOut)
async def create_schedule_route(
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    await check_group_access(db, data.group_id, pilot)
    schedule = await create_schedule(db, {**data.model_dump(), "created_by": pilot.id, "status": "draft"})
    return ScheduleOut(
        id=schedule.id,
        group_id=schedule.group_id,
        aircraft_id=schedule.aircraft_id,
        route_id=schedule.route_id,
        departure=schedule.departure,
        arrival=schedule.arrival,
        flight_number=schedule.flight_number,
        scheduled_departure=str(schedule.scheduled_departure),
        scheduled_arrival=str(schedule.scheduled_arrival),
        wave_id=schedule.wave_id,
        ground_time_minutes=schedule.ground_time_minutes or 60,
        status=schedule.status,
        created_by=schedule.created_by,
        week_start=str(schedule.week_start),
    )


@router.patch("/{schedule_id}", response_model=ScheduleOut)
async def update_schedule_route(
    schedule_id: int,
    data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    schedule = await get_schedule(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await check_group_access(db, schedule.group_id, pilot)
    schedule = await update_schedule(db, schedule_id, data.model_dump(exclude_none=True))
    if schedule.status == "approved":
        await try_auto_sync_to_if(db, schedule)
        await db.commit()
    return ScheduleOut(
        id=schedule.id,
        group_id=schedule.group_id,
        aircraft_id=schedule.aircraft_id,
        route_id=schedule.route_id,
        departure=schedule.departure,
        arrival=schedule.arrival,
        flight_number=schedule.flight_number,
        scheduled_departure=str(schedule.scheduled_departure),
        scheduled_arrival=str(schedule.scheduled_arrival),
        wave_id=schedule.wave_id,
        ground_time_minutes=schedule.ground_time_minutes or 60,
        status=schedule.status,
        created_by=schedule.created_by,
        week_start=str(schedule.week_start),
        if_schedule_id=schedule.if_schedule_id,
    )


@router.delete("/{schedule_id}")
async def delete_schedule_route(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    schedule = await get_schedule(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await check_group_access(db, schedule.group_id, pilot)

    if schedule.if_schedule_id:
        try:
            manager = IFTokenManager()
            client = await manager.get_client(db, pilot.id)
            await client.open()
            try:
                sync = IFScheduleSync(client)
                await sync.delete_if_schedule(db, schedule)
            finally:
                await client.close()
        except Exception:
            pass

    success = await delete_schedule(db, schedule_id)
    await db.commit()
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"detail": "Schedule deleted"}


@router.post("/{schedule_id}/propose", response_model=ScheduleOut)
async def propose_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    schedule = await get_schedule(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await check_group_access(db, schedule.group_id, pilot)
    schedule = await update_schedule_status(db, schedule_id, "proposed")
    return ScheduleOut(
        id=schedule.id,
        group_id=schedule.group_id,
        aircraft_id=schedule.aircraft_id,
        departure=schedule.departure,
        arrival=schedule.arrival,
        scheduled_departure=str(schedule.scheduled_departure),
        scheduled_arrival=str(schedule.scheduled_arrival),
        wave_id=schedule.wave_id,
        ground_time_minutes=schedule.ground_time_minutes or 60,
        status=schedule.status,
        created_by=schedule.created_by,
        week_start=str(schedule.week_start),
    )


@router.post("/{schedule_id}/approve", response_model=ScheduleOut)
async def approve_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    schedule = await update_schedule_status(db, schedule_id, "approved", approved_by=pilot.id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    await try_auto_sync_to_if(db, schedule)
    await db.commit()

    return ScheduleOut(
        id=schedule.id,
        group_id=schedule.group_id,
        aircraft_id=schedule.aircraft_id,
        departure=schedule.departure,
        arrival=schedule.arrival,
        scheduled_departure=str(schedule.scheduled_departure),
        scheduled_arrival=str(schedule.scheduled_arrival),
        wave_id=schedule.wave_id,
        ground_time_minutes=schedule.ground_time_minutes or 60,
        status=schedule.status,
        created_by=schedule.created_by,
        approved_by=schedule.approved_by,
        week_start=str(schedule.week_start),
        if_schedule_id=schedule.if_schedule_id,
    )


@router.post("/{schedule_id}/reject", response_model=ScheduleOut)
async def reject_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    schedule = await get_schedule(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if schedule.if_schedule_id:
        try:
            manager = IFTokenManager()
            client = await manager.get_client(db, pilot.id)
            await client.open()
            try:
                sync = IFScheduleSync(client)
                await sync.delete_if_schedule(db, schedule)
            finally:
                await client.close()
        except Exception:
            pass

    schedule = await update_schedule_status(db, schedule_id, "draft")
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await db.commit()
    return ScheduleOut(
        id=schedule.id,
        group_id=schedule.group_id,
        aircraft_id=schedule.aircraft_id,
        departure=schedule.departure,
        arrival=schedule.arrival,
        scheduled_departure=str(schedule.scheduled_departure),
        scheduled_arrival=str(schedule.scheduled_arrival),
        wave_id=schedule.wave_id,
        ground_time_minutes=schedule.ground_time_minutes or 60,
        status=schedule.status,
        created_by=schedule.created_by,
        week_start=str(schedule.week_start),
        if_schedule_id=schedule.if_schedule_id,
    )


@router.post("/bulk-approve")
async def bulk_approve(
    data: ScheduleBulkApprove,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    count = await bulk_approve_schedules(db, data.group_id, data.week_start, pilot.id)
    return {"detail": f"{count} schedules approved"}


# ---- WAVES ----

@router.get("/waves", response_model=list[WaveOut])
async def list_waves(
    group_id: int | None = Query(None),
    week_start: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    waves = await get_waves(db, group_id, week_start)
    return [
        WaveOut(
            id=w.id,
            name=w.name,
            wave_type=w.wave_type if hasattr(w, "wave_type") else "departure",
            departure_window_start=str(w.departure_window_start),
            departure_window_end=str(w.departure_window_end),
            week_start=str(w.week_start),
        )
        for w in waves
    ]


@router.post("/waves", response_model=WaveOut)
async def create_wave_route(
    data: WaveCreate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    wave_data = data.model_dump()
    if wave_data.get("group_id") == 0:
        wave_data["group_id"] = None
    wave = await create_wave(db, wave_data)
    return WaveOut(
        id=wave.id,
        name=wave.name,
        wave_type=wave.wave_type if hasattr(wave, "wave_type") else "departure",
        departure_window_start=str(wave.departure_window_start),
        departure_window_end=str(wave.departure_window_end),
        week_start=str(wave.week_start),
    )


@router.delete("/waves/{wave_id}")
async def delete_wave_route(
    wave_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    success = await delete_wave(db, wave_id)
    if not success:
        raise HTTPException(status_code=404, detail="Wave not found")
    return {"detail": "Wave deleted"}
