from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot
from app.models.live_models import Pilot
from app.schemas.career import (
    CareerPathDetailOut,
    CareerPathOut,
    CareerRankCreate,
    CareerRankOut,
    CareerRankUpdate,
    PilotCareerOut,
    PilotCareerProgressOut,
)
from app.services.career_service import (
    create_career_rank,
    get_all_career_paths,
    get_career_path_with_ranks,
    get_pilot_career_progress,
    get_pilot_careers,
    update_career_rank,
)

router = APIRouter(prefix="/careers", tags=["careers"])


@router.get("", response_model=list[CareerPathOut])
async def list_career_paths(db: AsyncSession = Depends(get_db)):
    return await get_all_career_paths(db)


@router.get("/{path_id}", response_model=CareerPathDetailOut)
async def get_career_path(path_id: int, db: AsyncSession = Depends(get_db)):
    path = await get_career_path_with_ranks(db, path_id)
    if not path:
        raise HTTPException(status_code=404, detail="Career path not found")

    ranks = []
    for rank in path.ranks:
        rank_data = CareerRankOut.model_validate(rank)
        ranks.append(rank_data)

    return CareerPathDetailOut(
        id=path.id,
        name=path.name,
        description=path.description,
        ranks=ranks,
    )


@router.get("/ranks/{rank_id}", response_model=CareerRankOut)
async def get_rank(rank_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.models.live_models import LiveCareerRank

    result = await db.execute(select(LiveCareerRank).where(LiveCareerRank.id == rank_id))
    rank = result.scalar_one_or_none()
    if not rank:
        raise HTTPException(status_code=404, detail="Rank not found")
    return rank


@router.post("/{path_id}/ranks", response_model=CareerRankOut)
async def create_rank(
    path_id: int,
    data: CareerRankCreate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    rank = await create_career_rank(db, path_id, data.model_dump())
    return rank


@router.patch("/ranks/{rank_id}", response_model=CareerRankOut)
async def update_rank(
    rank_id: int,
    data: CareerRankUpdate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    rank = await update_career_rank(db, rank_id, data.model_dump(exclude_none=True))
    if not rank:
        raise HTTPException(status_code=404, detail="Rank not found")
    return rank


# ---- Pilot career endpoints ----

@router.get("/pilot/{pilot_id}", response_model=list[PilotCareerOut])
async def get_pilot_careers_route(pilot_id: int, db: AsyncSession = Depends(get_db)):
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


@router.get("/pilot/{pilot_id}/path/{path_id}", response_model=PilotCareerProgressOut)
async def get_pilot_career_progress_route(
    pilot_id: int, path_id: int, db: AsyncSession = Depends(get_db)
):
    progress = await get_pilot_career_progress(db, pilot_id, path_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Pilot career not found")
    return progress
