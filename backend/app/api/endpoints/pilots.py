from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot
from app.models.live_models import Pilot
from app.schemas.pilot import PilotOut, PilotListOut, PilotDetailOut
from app.services.pilot_service import get_pilot_detail, get_pilot_list

router = APIRouter(prefix="/pilots", tags=["pilots"])


@router.get("", response_model=list[PilotListOut])
async def list_pilots(
    group_id: int | None = Query(None),
    career_path_id: int | None = Query(None),
    rank_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.live_models import LiveGroupPilot, LiveFlyingGroup, LivePilotCareer

    pilots = await get_pilot_list(db, group_id, career_path_id, rank_id)
    pilot_ids = [p.id for p in pilots]

    # Batch load active group assignments
    group_assignments = {}
    if pilot_ids:
        group_res = await db.execute(
            select(LiveGroupPilot, LiveFlyingGroup)
            .join(LiveFlyingGroup, LiveFlyingGroup.id == LiveGroupPilot.group_id)
            .where(
                LiveGroupPilot.pilot_id.in_(pilot_ids),
                LiveGroupPilot.removed_at.is_(None),
                LiveFlyingGroup.is_active == 1,
            )
        )
        for gp, g in group_res:
            group_assignments[gp.pilot_id] = g

    # Batch load careers with paths and ranks
    careers_by_pilot = {}
    if pilot_ids:
        career_res = await db.execute(
            select(LivePilotCareer)
            .where(LivePilotCareer.pilot_id.in_(pilot_ids))
            .options(
                selectinload(LivePilotCareer.career_path),
                selectinload(LivePilotCareer.current_rank),
            )
        )
        for c in career_res.scalars().all():
            if c.pilot_id not in careers_by_pilot:
                careers_by_pilot[c.pilot_id] = []
            careers_by_pilot[c.pilot_id].append(c)

    result = []
    for p in pilots:
        group = group_assignments.get(p.id)
        careers = careers_by_pilot.get(p.id, [])
        result.append(
            PilotListOut(
                id=p.id,
                callsign=p.callsign,
                name=p.name,
                grade=p.grade,
                group_name=group.name if group else None,
                career_path_names=[c.career_path.name for c in careers if c.career_path],
                current_ranks=[c.current_rank.name for c in careers if c.current_rank],
            )
        )
    return result


@router.get("/me", response_model=PilotDetailOut)
async def get_my_profile(
    pilot: Pilot = Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    detail = await get_pilot_detail(db, pilot.id)
    return PilotDetailOut(
        id=detail["pilot"].id,
        callsign=detail["pilot"].callsign,
        name=detail["pilot"].name,
        grade=detail["pilot"].grade,
        transhours=detail["pilot"].transhours,
        transflights=detail["pilot"].transflights,
        status=detail["pilot"].status,
        joined=str(detail["pilot"].joined) if detail["pilot"].joined else None,
        lifts=getattr(detail["pilot"], "lifts", 0) or 0,
        group_name=detail["group_name"],
        group_id=detail.get("group_id"),
        token_balance=detail["token_balance"],
        careers=detail["careers"],
    )


@router.get("/{pilot_id}", response_model=PilotDetailOut)
async def get_pilot(
    pilot_id: int,
    db: AsyncSession = Depends(get_db),
    current_pilot: Pilot = Depends(get_current_pilot),
):
    detail = await get_pilot_detail(db, pilot_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Pilot not found")
    return PilotDetailOut(
        id=detail["pilot"].id,
        callsign=detail["pilot"].callsign,
        name=detail["pilot"].name,
        grade=detail["pilot"].grade,
        transhours=detail["pilot"].transhours,
        transflights=detail["pilot"].transflights,
        status=detail["pilot"].status,
        joined=str(detail["pilot"].joined) if detail["pilot"].joined else None,
        lifts=getattr(detail["pilot"], "lifts", 0) or 0,
        group_name=detail["group_name"],
        group_id=detail.get("group_id"),
        token_balance=detail["token_balance"],
        careers=detail["careers"],
    )


@router.get("/me/proposal-transactions")
async def get_my_proposal_transactions(
    pilot: Pilot = Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.live_models import LiveCurrencyTransaction, LiveFlightSchedule
    
    # Fetch transactions of type "extra_proposal_slot"
    tx_res = await db.execute(
        select(LiveCurrencyTransaction)
        .where(
            LiveCurrencyTransaction.pilot_id == pilot.id,
            LiveCurrencyTransaction.transaction_type == "extra_proposal_slot"
        )
        .order_by(LiveCurrencyTransaction.created_at.desc())
    )
    transactions = list(tx_res.scalars().all())
    
    # Gather unique schedule IDs (reference_id) that are not None/0
    schedule_ids = [tx.reference_id for tx in transactions if tx.reference_id and tx.reference_id > 0]
    
    schedules_by_id = {}
    if schedule_ids:
        sched_res = await db.execute(
            select(LiveFlightSchedule).where(LiveFlightSchedule.id.in_(schedule_ids))
        )
        for s in sched_res.scalars().all():
            schedules_by_id[s.id] = s

    # Format results
    logs = []
    for tx in transactions:
        flight_detail = None
        if tx.reference_id and tx.reference_id in schedules_by_id:
            s = schedules_by_id[tx.reference_id]
            flight_detail = {
                "flight_number": s.flight_number,
                "departure": s.departure,
                "arrival": s.arrival,
                "week_start": str(s.week_start)
            }
            
        logs.append({
            "id": tx.id,
            "amount": tx.amount,
            "description": tx.description,
            "created_at": str(tx.created_at),
            "reference_id": tx.reference_id,
            "flight_detail": flight_detail
        })
        
    return logs

