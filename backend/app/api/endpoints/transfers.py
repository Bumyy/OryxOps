from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import LiveTransfer, Pilot
from app.schemas.transfer import TransferCreate, TransferOut, TransferReview

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.get("", response_model=list[TransferOut])
async def list_transfers(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    from app.models.live_models import StaffRole

    staff_result = await db.execute(select(StaffRole).where(StaffRole.user_id == pilot.id))
    is_staff = staff_result.scalar_one_or_none() is not None

    query = select(LiveTransfer)
    if not is_staff:
        query = query.where(LiveTransfer.pilot_id == pilot.id)

    result = await db.execute(query.order_by(LiveTransfer.requested_at.desc()))
    transfers = list(result.scalars().all())

    return [
        TransferOut(
            id=t.id,
            pilot_id=t.pilot_id,
            pilot_callsign=t.pilot.callsign,
            transfer_type=t.transfer_type,
            from_value=t.from_value,
            to_value=t.to_value,
            reason=t.reason,
            status=t.status,
            requested_at=str(t.requested_at),
            reviewed_by=t.reviewed_by,
            reviewed_by_name=t.reviewer.callsign if t.reviewer else None,
            reviewed_at=str(t.reviewed_at) if t.reviewed_at else None,
        )
        for t in transfers
    ]


@router.post("", response_model=TransferOut)
async def create_transfer(
    data: TransferCreate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    transfer = LiveTransfer(
        pilot_id=pilot.id,
        transfer_type=data.transfer_type,
        from_value=data.from_value,
        to_value=data.to_value,
        reason=data.reason,
        status="pending",
    )
    db.add(transfer)
    await db.commit()
    await db.refresh(transfer)

    return TransferOut(
        id=transfer.id,
        pilot_id=transfer.pilot_id,
        pilot_callsign=pilot.callsign,
        transfer_type=transfer.transfer_type,
        from_value=transfer.from_value,
        to_value=transfer.to_value,
        reason=transfer.reason,
        status=transfer.status,
        requested_at=str(transfer.requested_at),
    )


@router.patch("/{transfer_id}", response_model=TransferOut)
async def review_transfer(
    transfer_id: int,
    data: TransferReview,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    from datetime import datetime
    from sqlalchemy import delete, func
    from app.models.live_models import (
        LiveFlyingGroup,
        LiveGroupPilot,
        LiveCareerPath,
        LiveCareerRank,
        LivePilotCareer,
        Pilot,
        LiveTransfer,
    )

    result = await db.execute(select(LiveTransfer).where(LiveTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if data.status == "approved" and transfer.status != "approved":
        # 1. Process Group Switch
        if transfer.transfer_type == "group_switch":
            group_res = await db.execute(
                select(LiveFlyingGroup).where(
                    func.lower(LiveFlyingGroup.name) == func.lower(transfer.to_value),
                    LiveFlyingGroup.is_active == 1,
                )
            )
            target_group = group_res.scalar_one_or_none()
            if not target_group:
                raise HTTPException(
                    status_code=400,
                    detail=f"Target active group '{transfer.to_value}' not found",
                )

            # Deactivate current active group assignments for this pilot
            ca_res = await db.execute(
                select(LiveGroupPilot)
                .join(LiveFlyingGroup, LiveFlyingGroup.id == LiveGroupPilot.group_id)
                .where(
                    LiveGroupPilot.pilot_id == transfer.pilot_id,
                    LiveGroupPilot.removed_at.is_(None),
                    LiveFlyingGroup.is_active == 1,
                )
            )
            for ca in ca_res.scalars().all():
                ca.removed_at = datetime.utcnow()

            # Add to the new group
            db.add(
                LiveGroupPilot(
                    group_id=target_group.id,
                    pilot_id=transfer.pilot_id,
                    is_group_admin=0,
                )
            )

            # Update the pilot's flying_groupid
            pilot_res = await db.execute(select(Pilot).where(Pilot.id == transfer.pilot_id))
            p = pilot_res.scalar_one_or_none()
            if p:
                p.flying_groupid = target_group.id

        # 2. Process Career Path Switch
        elif transfer.transfer_type == "career_path_switch":
            path_res = await db.execute(
                select(LiveCareerPath).where(
                    func.lower(LiveCareerPath.name) == func.lower(transfer.to_value),
                    LiveCareerPath.is_active == 1,
                )
            )
            target_path = path_res.scalar_one_or_none()
            if not target_path:
                raise HTTPException(
                    status_code=400,
                    detail=f"Target active career path '{transfer.to_value}' not found",
                )

            # Delete old career entries
            await db.execute(
                delete(LivePilotCareer).where(LivePilotCareer.pilot_id == transfer.pilot_id)
            )

            # Get first rank
            rank_res = await db.execute(
                select(LiveCareerRank)
                .where(LiveCareerRank.career_path_id == target_path.id)
                .order_by(LiveCareerRank.sort_order)
                .limit(1)
            )
            first_rank = rank_res.scalar_one_or_none()
            if not first_rank:
                raise HTTPException(
                    status_code=400,
                    detail="Target career path has no ranks configured",
                )

            # Create new career
            db.add(
                LivePilotCareer(
                    pilot_id=transfer.pilot_id,
                    career_path_id=target_path.id,
                    current_rank_id=first_rank.id,
                )
            )

    transfer.status = data.status
    transfer.reviewed_by = staff.id
    transfer.reviewed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(transfer)

    return TransferOut(
        id=transfer.id,
        pilot_id=transfer.pilot_id,
        pilot_callsign=transfer.pilot.callsign,
        transfer_type=transfer.transfer_type,
        from_value=transfer.from_value,
        to_value=transfer.to_value,
        reason=transfer.reason,
        status=transfer.status,
        requested_at=str(transfer.requested_at),
        reviewed_by=transfer.reviewed_by,
        reviewed_by_name=staff.callsign,
        reviewed_at=str(transfer.reviewed_at),
    )
