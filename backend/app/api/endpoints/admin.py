from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_staff
from app.models.live_models import Pilot
from app.schemas.career import PilotCareerOut
from app.services.career_service import promote_pilot

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/promote/{pilot_id}", response_model=PilotCareerOut)
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
