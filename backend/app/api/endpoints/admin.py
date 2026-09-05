from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_staff
from app.models.live_models import (
    LiveFlyingGroup,
    LiveGroupAircraft,
    LiveGroupPilot,
    LiveCurrency,
    Pilot,
    AwardGranted,
)

router = APIRouter(prefix="/admin", tags=["admin"])


class EnrollPilotRequest(BaseModel):
    pilot_id: int
    simbrief_id: int | None = None


class UpdateSimbriefRequest(BaseModel):
    pilot_id: int
    simbrief_id: int | None = None


class ReshuffleRequest(BaseModel):
    group_id: int


# ── UPDATE PILOT SIMBRIEF ID ──

@router.post("/update-simbrief")
async def update_pilot_simbrief(
    data: UpdateSimbriefRequest,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    pilot = await db.get(Pilot, data.pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")
    if pilot.status != 1:
        raise HTTPException(status_code=400, detail="Can only update active pilots")
        
    pilot.simbrief_id = data.simbrief_id
    await db.commit()
    return {"detail": "Simbrief ID updated", "simbrief_id": pilot.simbrief_id}


# ── ENROLL PILOT IN LIVE SYSTEM ──

@router.post("/enroll-pilot")
async def enroll_pilot(
    data: EnrollPilotRequest,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    pilot = await db.get(Pilot, data.pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")
    if pilot.status != 1:
        raise HTTPException(status_code=400, detail="Can only enroll active pilots")

    # Update simbrief_id if provided
    if data.simbrief_id is not None:
        pilot.simbrief_id = data.simbrief_id

    # Grant Award ID 9 if not already granted
    award_exist = await db.execute(
        select(AwardGranted).where(
            AwardGranted.awardid == 9,
            AwardGranted.pilotid == data.pilot_id
        )
    )
    if not award_exist.scalar_one_or_none():
        db.add(AwardGranted(awardid=9, pilotid=data.pilot_id, dateawarded=date.today()))

    # Initialize wallet if not exists
    curr_res = await db.execute(select(LiveCurrency).where(LiveCurrency.pilot_id == data.pilot_id))
    if not curr_res.scalar_one_or_none():
        db.add(LiveCurrency(pilot_id=data.pilot_id, balance=0, total_earned=0, total_spent=0))

    await db.commit()
    return {"detail": "Pilot enrolled successfully"}


class AdminUpdatePilotRequest(BaseModel):
    pilot_id: int
    lifts: int | None = None
    flying_groupid: int | None = None


@router.post("/update-pilot")
async def update_pilot_admin(
    data: AdminUpdatePilotRequest,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    pilot = await db.get(Pilot, data.pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")

    if data.lifts is not None:
        pilot.lifts = data.lifts
    if data.flying_groupid is not None:
        pilot.flying_groupid = data.flying_groupid

    await db.commit()
    return {"detail": "Pilot settings updated successfully"}


class EnrollByCallsignRequest(BaseModel):
    callsign: str
    simbrief_id: int | None = None


@router.post("/enroll-by-callsign")
async def enroll_pilot_by_callsign(
    data: EnrollByCallsignRequest,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    from sqlalchemy import func
    clean_callsign = data.callsign.strip()
    pilot_res = await db.execute(
        select(Pilot).where(func.lower(Pilot.callsign) == clean_callsign.lower())
    )
    pilot = pilot_res.scalar_one_or_none()
    if not pilot:
        raise HTTPException(status_code=404, detail=f"Pilot with callsign '{clean_callsign}' not found.")

    if pilot.status != 1:
        raise HTTPException(status_code=400, detail=f"Pilot {pilot.callsign} is not active.")

    if data.simbrief_id is not None:
        pilot.simbrief_id = data.simbrief_id

    # Grant Award ID 9 if not already granted
    award_exist = await db.execute(
        select(AwardGranted).where(
            AwardGranted.awardid == 9,
            AwardGranted.pilotid == pilot.id
        )
    )
    if not award_exist.scalar_one_or_none():
        db.add(AwardGranted(awardid=9, pilotid=pilot.id, dateawarded=date.today()))

    # Initialize wallet if not exists
    curr_res = await db.execute(select(LiveCurrency).where(LiveCurrency.pilot_id == pilot.id))
    if not curr_res.scalar_one_or_none():
        db.add(LiveCurrency(pilot_id=pilot.id, balance=0, total_earned=0, total_spent=0))

    await db.commit()

    return {
        "detail": f"Pilot {pilot.callsign} enrolled successfully with Award 9 granted!",
        "pilot_id": pilot.id,
        "callsign": pilot.callsign,
    }


# ── GET ENROLLED PILOTS ONLY (OPTIMIZED) ──

@router.get("/enrolled-pilots")
async def get_enrolled_pilots(db: AsyncSession = Depends(get_db), staff=Depends(get_current_staff)):
    result = await db.execute(
        select(Pilot)
        .join(AwardGranted, AwardGranted.pilotid == Pilot.id)
        .where(Pilot.status == 1, AwardGranted.awardid == 9)
    )
    pilots = result.scalars().all()

    enrolled = []
    for p in pilots:
        enrolled.append({
            "id": p.id,
            "callsign": p.callsign,
            "name": p.name,
            "simbrief_id": p.simbrief_id,
            "lifts": getattr(p, "lifts", 0) or 0,
            "flying_groupid": p.flying_groupid,
            "enrolled": True,
        })

    return {"enrolled": enrolled, "unenrolled": []}


# ── MONTHLY RESHUFFLE ──

@router.post("/reshuffle/{group_id}")
async def reshuffle_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    import re
    old_group = await db.execute(select(LiveFlyingGroup).where(LiveFlyingGroup.id == group_id))
    old = old_group.scalar_one_or_none()
    if not old:
        raise HTTPException(status_code=404, detail="Group not found")

    today = date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        month_end = today.replace(month=today.month + 1, day=1)

    # Clean existing suffix (like (New), (June 2026), etc.)
    base_name = re.sub(r"\s*\([^)]*\)\s*$", "", old.name).strip()
    month_name = month_start.strftime("%B %Y")
    new_name = f"{base_name} ({month_name})"

    new_group = LiveFlyingGroup(
        name=new_name,
        discord_channel_id=old.discord_channel_id,
        period_start=month_start,
        period_end=month_end,
    )
    db.add(new_group)
    await db.flush()

    members = await db.execute(
        select(LiveGroupPilot).where(
            LiveGroupPilot.group_id == group_id,
            LiveGroupPilot.removed_at.is_(None),
        )
    )
    members_list = list(members.scalars().all())
    for m in members_list:
        db.add(LiveGroupPilot(
            group_id=new_group.id,
            pilot_id=m.pilot_id,
            is_group_admin=m.is_group_admin,
        ))

    if members_list:
        from sqlalchemy import update
        await db.execute(
            update(Pilot)
            .where(Pilot.id.in_([m.pilot_id for m in members_list]))
            .values(flying_groupid=new_group.id)
        )

    ac_result = await db.execute(
        select(LiveGroupAircraft).where(
            LiveGroupAircraft.group_id == group_id,
            LiveGroupAircraft.removed_at.is_(None),
        )
    )
    for a in ac_result.scalars().all():
        db.add(LiveGroupAircraft(
            group_id=new_group.id,
            aircraft_id=a.aircraft_id,
        ))

    old.is_active = 0
    await db.commit()
    await db.refresh(new_group)

    return {
        "detail": "Group reshuffled",
        "old_group_id": old.id,
        "new_group_id": new_group.id,
        "new_group_name": new_group.name,
        "period_start": str(new_group.period_start),
        "period_end": str(new_group.period_end),
    }





# ── FLEET PAIR ASSIGNMENT & SHUFFLE (ADMIN) ──

class AssignFramePilotsRequest(BaseModel):
    aircraft_id: int
    pilot1_id: int | None = None
    pilot2_id: int | None = None


async def _get_pilot_total_pirep_seconds(db: AsyncSession, pilot_id: int) -> int:
    from app.services.hours_service import get_pilot_booking_total_seconds
    return await get_pilot_booking_total_seconds(db, pilot_id)


@router.post("/fleet/assign")
async def assign_frame_pilots(
    data: AssignFramePilotsRequest,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    from app.models.live_models import LiveAircraft
    result = await db.execute(select(LiveAircraft).where(LiveAircraft.id == data.aircraft_id))
    aircraft = result.scalar_one_or_none()
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    pilots_to_assign = [p for p in [data.pilot1_id, data.pilot2_id] if p is not None]

    # Strict Rule: Auto-vacate assigned pilots from any previous aircraft frame
    from sqlalchemy import or_
    for p_id in pilots_to_assign:
        prev_ac_res = await db.execute(
            select(LiveAircraft).where(
                LiveAircraft.id != data.aircraft_id,
                or_(
                    LiveAircraft.assigned_captain_id == p_id,
                    LiveAircraft.assigned_fo_id == p_id,
                ),
            )
        )
        for prev_ac in prev_ac_res.scalars().all():
            if prev_ac.assigned_captain_id == p_id:
                prev_ac.assigned_captain_id = None
            if prev_ac.assigned_fo_id == p_id:
                prev_ac.assigned_fo_id = None

    if len(pilots_to_assign) == 0:
        aircraft.assigned_captain_id = None
        aircraft.assigned_fo_id = None
    elif len(pilots_to_assign) == 1:
        aircraft.assigned_captain_id = pilots_to_assign[0]
        aircraft.assigned_fo_id = None
    else:
        # 2 pilots: calculate total PIREP hours to assign Captain (higher hours) and FO (lower hours)
        p1_secs = await _get_pilot_total_pirep_seconds(db, pilots_to_assign[0])
        p2_secs = await _get_pilot_total_pirep_seconds(db, pilots_to_assign[1])

        if p1_secs >= p2_secs:
            aircraft.assigned_captain_id = pilots_to_assign[0]
            aircraft.assigned_fo_id = pilots_to_assign[1]
        else:
            aircraft.assigned_captain_id = pilots_to_assign[1]
            aircraft.assigned_fo_id = pilots_to_assign[0]

    await db.commit()
    await db.refresh(aircraft)
    return {
        "detail": "Aircraft pilot crew updated",
        "aircraft_id": aircraft.id,
        "assigned_captain_id": aircraft.assigned_captain_id,
        "assigned_fo_id": aircraft.assigned_fo_id,
    }


@router.post("/fleet/auto-shuffle/{group_id}")
async def auto_shuffle_group_fleet(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    from app.models.live_models import LiveGroupPilot, LiveGroupAircraft, LiveAircraft, Pilot
    
    # 1. Fetch active pilots in group
    gp_res = await db.execute(
        select(LiveGroupPilot)
        .where(LiveGroupPilot.group_id == group_id, LiveGroupPilot.removed_at.is_(None))
    )
    group_pilots = gp_res.scalars().all()
    pilot_ids = [gp.pilot_id for gp in group_pilots]

    # 2. Fetch active aircraft in group
    ga_res = await db.execute(
        select(LiveGroupAircraft)
        .where(LiveGroupAircraft.group_id == group_id, LiveGroupAircraft.removed_at.is_(None))
        .options(selectinload(LiveGroupAircraft.aircraft))
    )
    group_aircraft = ga_res.scalars().all()
    aircraft_list = [ga.aircraft for ga in group_aircraft if ga.aircraft]

    if not aircraft_list:
        raise HTTPException(status_code=400, detail="No active aircraft in group to shuffle")

    # 3. Calculate PIREP hours for each pilot and sort descending
    pilot_hours = []
    for pid in pilot_ids:
        secs = await _get_pilot_total_pirep_seconds(db, pid)
        pilot_hours.append((pid, secs))

    # Sort pilots by total PIREP seconds descending
    pilot_hours.sort(key=lambda x: x[1], reverse=True)

    sorted_pilot_ids = [p[0] for p in pilot_hours]

    # 4. Pair pilots into crews across aircraft
    pilot_idx = 0
    assigned_count = 0

    for aircraft in aircraft_list:
        if pilot_idx < len(sorted_pilot_ids):
            cap_id = sorted_pilot_ids[pilot_idx]
            pilot_idx += 1
            fo_id = None
            if pilot_idx < len(sorted_pilot_ids):
                fo_id = sorted_pilot_ids[pilot_idx]
                pilot_idx += 1

            aircraft.assigned_captain_id = cap_id
            aircraft.assigned_fo_id = fo_id
            assigned_count += 1
        else:
            aircraft.assigned_captain_id = None
            aircraft.assigned_fo_id = None

    await db.commit()
    return {
        "detail": "Fleet auto-shuffled successfully",
        "group_id": group_id,
        "shuffled_aircraft_count": assigned_count,
        "total_pilots_assigned": pilot_idx,
        "unassigned_pilots_count": max(0, len(sorted_pilot_ids) - pilot_idx),
    }
