from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import (
    LiveCareerPath,
    LiveCareerRank,
    LiveCareerRankAircraft,
    Pilot,
)
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


class CareerPathCreate(BaseModel):
    name: str
    description: str | None = None


class RankAircraftAssign(BaseModel):
    aircraft_type_id: int
    count: int = 1


# ── CAREER PATHS ──

@router.get("", response_model=list[CareerPathOut])
async def list_career_paths(db: AsyncSession = Depends(get_db)):
    return await get_all_career_paths(db)


@router.post("", response_model=CareerPathOut)
async def create_career_path(
    data: CareerPathCreate,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    path = LiveCareerPath(name=data.name, description=data.description)
    db.add(path)
    await db.commit()
    await db.refresh(path)
    return path


@router.get("/{path_id}", response_model=CareerPathDetailOut)
async def get_career_path(path_id: int, db: AsyncSession = Depends(get_db)):
    path = await get_career_path_with_ranks(db, path_id)
    if not path:
        raise HTTPException(status_code=404, detail="Career path not found")
    return CareerPathDetailOut(
        id=path.id,
        name=path.name,
        description=path.description,
        ranks=[CareerRankOut.model_validate(r) for r in path.ranks],
    )


@router.delete("/{path_id}")
async def delete_career_path(
    path_id: int,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    result = await db.execute(select(LiveCareerPath).where(LiveCareerPath.id == path_id))
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Career path not found")
    await db.delete(path)
    await db.commit()
    return {"detail": "Career path deleted"}


# ── RANKS ──

@router.get("/ranks/{rank_id}", response_model=CareerRankOut)
async def get_rank(rank_id: int, db: AsyncSession = Depends(get_db)):
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
    staff: Pilot = Depends(get_current_staff),
):
    rank = await create_career_rank(db, path_id, data.model_dump())
    return rank


@router.patch("/ranks/{rank_id}", response_model=CareerRankOut)
async def update_rank(
    rank_id: int,
    data: CareerRankUpdate,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    rank = await update_career_rank(db, rank_id, data.model_dump(exclude_none=True))
    if not rank:
        raise HTTPException(status_code=404, detail="Rank not found")
    return rank


@router.delete("/ranks/{rank_id}")
async def delete_rank(
    rank_id: int,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    result = await db.execute(select(LiveCareerRank).where(LiveCareerRank.id == rank_id))
    rank = result.scalar_one_or_none()
    if not rank:
        raise HTTPException(status_code=404, detail="Rank not found")
    await db.delete(rank)
    await db.commit()
    return {"detail": "Rank deleted"}


# ── RANK AIRCRAFT ──

@router.get("/ranks/{rank_id}/aircraft")
async def get_rank_aircraft(rank_id: int, db: AsyncSession = Depends(get_db)):
    from app.models.live_models import Aircraft

    result = await db.execute(
        select(LiveCareerRankAircraft, Aircraft.name)
        .join(Aircraft, LiveCareerRankAircraft.aircraft_type_id == Aircraft.id)
        .where(LiveCareerRankAircraft.career_rank_id == rank_id)
    )
    rows = result.all()
    return [
        {
            "id": row.LiveCareerRankAircraft.id,
            "aircraft_type_id": row.LiveCareerRankAircraft.aircraft_type_id,
            "aircraft_name": row.name,
            "count": row.LiveCareerRankAircraft.count,
        }
        for row in rows
    ]


@router.post("/ranks/{rank_id}/aircraft")
async def assign_aircraft_to_rank(
    rank_id: int,
    data: RankAircraftAssign,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    existing = await db.execute(
        select(LiveCareerRankAircraft).where(
            LiveCareerRankAircraft.career_rank_id == rank_id,
            LiveCareerRankAircraft.aircraft_type_id == data.aircraft_type_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Aircraft type already assigned to this rank")

    ra = LiveCareerRankAircraft(
        career_rank_id=rank_id,
        aircraft_type_id=data.aircraft_type_id,
        count=data.count,
    )
    db.add(ra)
    await db.commit()
    await db.refresh(ra)
    return {"id": ra.id, "aircraft_type_id": ra.aircraft_type_id, "count": ra.count}


@router.delete("/ranks/{rank_id}/aircraft/{aircraft_type_id}")
async def remove_aircraft_from_rank(
    rank_id: int,
    aircraft_type_id: int,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    result = await db.execute(
        select(LiveCareerRankAircraft).where(
            LiveCareerRankAircraft.career_rank_id == rank_id,
            LiveCareerRankAircraft.aircraft_type_id == aircraft_type_id,
        )
    )
    ra = result.scalar_one_or_none()
    if not ra:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(ra)
    await db.commit()
    return {"detail": "Aircraft type removed from rank"}


# ── PILOT CAREERS ──

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
