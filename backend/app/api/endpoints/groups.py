from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import Pilot
from app.schemas.group import (
    AssignAircraftRequest,
    AssignPilotsRequest,
    FlyingGroupCreate,
    FlyingGroupOut,
    FlyingGroupUpdate,
    GroupAircraftOut,
    GroupDetailOut,
    GroupPilotOut,
    ToggleAdminRequest,
)
from app.services.group_service import (
    assign_aircraft_to_group,
    assign_pilots_to_group,
    create_group,
    get_all_groups,
    get_group_aircraft,
    get_group_aircraft_count,
    get_group_member_count,
    get_group_members,
    get_group_with_members_aircraft,
    remove_aircraft_from_group,
    remove_pilot_from_group,
    toggle_group_admin,
    update_group,
)

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("", response_model=list[FlyingGroupOut])
async def list_groups(db: AsyncSession = Depends(get_db)):
    groups = await get_all_groups(db)
    result = []
    for g in groups:
        member_count = await get_group_member_count(db, g.id)
        aircraft_count = await get_group_aircraft_count(db, g.id)
        result.append(
            FlyingGroupOut(
                id=g.id,
                name=g.name,
                discord_channel_id=g.discord_channel_id,
                is_active=bool(g.is_active),
                period_start=str(g.period_start),
                period_end=str(g.period_end),
                member_count=member_count,
                aircraft_count=aircraft_count,
            )
        )
    return result


@router.get("/{group_id}", response_model=GroupDetailOut)
async def get_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await get_group_with_members_aircraft(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return GroupDetailOut(
        id=group.id,
        name=group.name,
        discord_channel_id=group.discord_channel_id,
        is_active=bool(group.is_active),
        period_start=str(group.period_start),
        period_end=str(group.period_end),
        member_count=len(group.group_pilots),
        aircraft_count=len(group.group_aircraft),
        members=[
            GroupPilotOut(
                id=gp.id,
                pilot_id=gp.pilot_id,
                pilot_callsign=gp.pilot.callsign,
                pilot_name=gp.pilot.name,
                is_group_admin=bool(gp.is_group_admin),
                assigned_at=str(gp.assigned_at) if gp.assigned_at else None,
            )
            for gp in group.group_pilots
        ],
        aircraft=[
            GroupAircraftOut(
                id=ga.id,
                aircraft_id=ga.aircraft_id,
                registration=ga.aircraft.registration,
                aircraft_type_name=ga.aircraft.aircraft_type.name if ga.aircraft.aircraft_type else None,
                current_airport=ga.aircraft.current_airport,
                status=ga.aircraft.status,
                assigned_at=str(ga.assigned_at) if ga.assigned_at else None,
            )
            for ga in group.group_aircraft
        ],
    )


@router.post("", response_model=FlyingGroupOut)
async def create_group_route(
    data: FlyingGroupCreate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    group = await create_group(db, data.model_dump())
    return FlyingGroupOut(
        id=group.id,
        name=group.name,
        discord_channel_id=group.discord_channel_id,
        is_active=bool(group.is_active),
        period_start=str(group.period_start),
        period_end=str(group.period_end),
        member_count=0,
        aircraft_count=0,
    )


@router.patch("/{group_id}", response_model=FlyingGroupOut)
async def update_group_route(
    group_id: int,
    data: FlyingGroupUpdate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    group = await update_group(db, group_id, data.model_dump(exclude_none=True))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return FlyingGroupOut(
        id=group.id,
        name=group.name,
        discord_channel_id=group.discord_channel_id,
        is_active=bool(group.is_active),
        period_start=str(group.period_start),
        period_end=str(group.period_end),
        member_count=await get_group_member_count(db, group_id),
        aircraft_count=await get_group_aircraft_count(db, group_id),
    )


@router.post("/{group_id}/members", response_model=list[GroupPilotOut])
async def assign_pilots(
    group_id: int,
    data: AssignPilotsRequest,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    assignments = await assign_pilots_to_group(db, group_id, data.pilot_ids, data.is_group_admin)
    return [
        GroupPilotOut(
            id=a.id,
            pilot_id=a.pilot_id,
            is_group_admin=bool(a.is_group_admin),
            assigned_at=str(a.assigned_at) if a.assigned_at else None,
        )
        for a in assignments
    ]


@router.delete("/{group_id}/members/{pilot_id}")
async def remove_pilot(
    group_id: int,
    pilot_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    success = await remove_pilot_from_group(db, group_id, pilot_id)
    if not success:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"detail": "Pilot removed from group"}


@router.post("/{group_id}/aircraft", response_model=list[GroupAircraftOut])
async def assign_aircraft(
    group_id: int,
    data: AssignAircraftRequest,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    assignments = await assign_aircraft_to_group(db, group_id, data.aircraft_ids)
    return [
        GroupAircraftOut(
            id=a.id,
            aircraft_id=a.aircraft_id,
            assigned_at=str(a.assigned_at) if a.assigned_at else None,
        )
        for a in assignments
    ]


@router.delete("/{group_id}/aircraft/{aircraft_id}")
async def remove_aircraft(
    group_id: int,
    aircraft_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    success = await remove_aircraft_from_group(db, group_id, aircraft_id)
    if not success:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"detail": "Aircraft removed from group"}


@router.patch("/{group_id}/members/{pilot_id}/admin", response_model=GroupPilotOut)
async def toggle_admin(
    group_id: int,
    pilot_id: int,
    data: ToggleAdminRequest,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_staff),
):
    assignment = await toggle_group_admin(db, group_id, pilot_id, data.is_group_admin)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return GroupPilotOut(
        id=assignment.id,
        pilot_id=assignment.pilot_id,
        is_group_admin=bool(assignment.is_group_admin),
        assigned_at=str(assignment.assigned_at) if assignment.assigned_at else None,
    )
