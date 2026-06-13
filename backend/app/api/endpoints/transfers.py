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

    result = await db.execute(select(LiveTransfer).where(LiveTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

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
