from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_staff
from app.models.live_models import (
    LiveCareerPath,
    LiveCareerRank,
    LiveFlyingGroup,
    LiveGroupAircraft,
    LiveGroupPilot,
    LivePilotCareer,
    LiveTokens,
    Pilot,
)
from app.schemas.career import PilotCareerOut
from app.services.career_service import promote_pilot

router = APIRouter(prefix="/admin", tags=["admin"])

PILOT_CAREER_REFETCH = PilotCareerOut


class EnrollPilotRequest(BaseModel):
    pilot_id: int
    career_path_id: int


class ReshuffleRequest(BaseModel):
    group_id: int


# ── PROMOTE ──

@router.post("/promote/{pilot_id}")
async def promote_pilot_route(
    pilot_id: int,
    career_path_id: int,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    pilot_career = await promote_pilot(db, pilot_id, career_path_id)
    if not pilot_career:
        raise HTTPException(status_code=404, detail="Pilot career or next rank not found")

    return PilotCareerOut(
        id=pilot_career.id,
        career_path_id=pilot_career.career_path_id,
        career_path_name=pilot_career.career_path.name,
        current_rank_id=pilot_career.current_rank_id,
        current_rank_name=pilot_career.current_rank.name if pilot_career.current_rank else None,
        sort_order=pilot_career.current_rank.sort_order if pilot_career.current_rank else None,
        started_at=str(pilot_career.started_at) if pilot_career.started_at else None,
        promoted_at=str(pilot_career.promoted_at) if pilot_career.promoted_at else None,
    )


# ── ENROLL PILOT IN LIVE SYSTEM ──

@router.post("/enroll-pilot")
async def enroll_pilot(
    data: EnrollPilotRequest,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    existing = await db.execute(
        select(LivePilotCareer).where(
            LivePilotCareer.pilot_id == data.pilot_id,
            LivePilotCareer.career_path_id == data.career_path_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Pilot already enrolled in this career path")

    first_rank = await db.execute(
        select(LiveCareerRank)
        .where(LiveCareerRank.career_path_id == data.career_path_id)
        .order_by(LiveCareerRank.sort_order)
        .limit(1)
    )
    rank = first_rank.scalar_one_or_none()
    if not rank:
        raise HTTPException(status_code=400, detail="Career path has no ranks configured")

    career = LivePilotCareer(
        pilot_id=data.pilot_id,
        career_path_id=data.career_path_id,
        current_rank_id=rank.id,
    )
    db.add(career)

    token_wallet = await db.execute(
        select(LiveTokens).where(LiveTokens.pilot_id == data.pilot_id)
    )
    if not token_wallet.scalar_one_or_none():
        db.add(LiveTokens(pilot_id=data.pilot_id, balance=0, total_earned=0, total_spent=0))

    await db.commit()
    await db.refresh(career)

    return {
        "detail": "Pilot enrolled",
        "career_path_id": career.career_path_id,
        "current_rank_id": career.current_rank_id,
    }


# ── GET ENROLLED PILOTS ──

@router.get("/enrolled-pilots")
async def get_enrolled_pilots(db: AsyncSession = Depends(get_db), staff=Depends(get_current_staff)):
    result = await db.execute(
        select(LivePilotCareer)
        .options(
            selectinload(LivePilotCareer.career_path),
            selectinload(LivePilotCareer.current_rank),
        )
    )
    careers = result.scalars().all()

    from collections import defaultdict
    pilot_careers = defaultdict(list)
    for c in careers:
        pilot_careers[c.pilot_id].append({
            "career_path_id": c.career_path_id,
            "career_path_name": c.career_path.name if c.career_path else None,
            "current_rank_id": c.current_rank_id,
            "current_rank_name": c.current_rank.name if c.current_rank else None,
        })

    all_pilots = await db.execute(select(Pilot).where(Pilot.status == 1))
    pilots = list(all_pilots.scalars().all())

    enrolled = []
    unenrolled = []
    for p in pilots:
        entry = {
            "id": p.id,
            "callsign": p.callsign,
            "name": p.name,
            "careers": [],
        }
        if p.id in pilot_careers:
            entry["enrolled"] = True
            entry["careers"] = pilot_careers[p.id]
            enrolled.append(entry)
        else:
            entry["enrolled"] = False
            unenrolled.append(entry)

    return {"enrolled": enrolled, "unenrolled": unenrolled}


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


# ── GET PILOT CAREERS (ADMIN VIEW) ──

@router.get("/pilot/{pilot_id}/careers", response_model=list[PilotCareerOut])
async def get_pilot_careers_admin(
    pilot_id: int,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    from app.services.career_service import get_pilot_careers

    careers = await get_pilot_careers(db, pilot_id)
    return [
        PilotCareerOut(
            id=c.id,
            career_path_id=c.career_path_id,
            career_path_name=c.career_path.name,
            current_rank_id=c.current_rank_id,
            current_rank_name=c.current_rank.name,
            sort_order=c.current_rank.sort_order,
            started_at=str(c.started_at) if c.started_at else None,
            promoted_at=str(c.promoted_at) if c.promoted_at else None,
        )
        for c in careers
    ]
