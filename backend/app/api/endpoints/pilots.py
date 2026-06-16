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
    from app.services.group_service import get_pilot_active_group

    pilots = await get_pilot_list(db, group_id, career_path_id, rank_id)
    result = []
    for p in pilots:
        group = await get_pilot_active_group(db, p.id)
        from app.services.career_service import get_pilot_careers

        careers = await get_pilot_careers(db, p.id)
        result.append(
            PilotListOut(
                id=p.id,
                callsign=p.callsign,
                name=p.name,
                grade=p.grade,
                group_name=group.name if group else None,
                career_path_names=[c.career_path.name for c in careers],
                current_ranks=[c.current_rank.name for c in careers],
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
        group_name=detail["group_name"],
        group_id=detail.get("group_id"),
        token_balance=detail["token_balance"],
        careers=detail["careers"],
    )
