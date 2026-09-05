from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import (
    LiveBiddingSession,
    LiveBiddingApplicant,
    LiveFlyingGroup,
    LiveGroupPilot,
    LiveCurrency,
    LiveCurrencyTransaction,
    LiveTransfer,
    Pilot,
    StaffRole,
)
from app.schemas.bidding import (
    BiddingSessionCreate,
    BiddingSessionOut,
    BiddingApplicantOut,
    ApplicantHours,
    FinalizeBiddingRequest,
)
from app.services.hours_service import calculate_pilot_booking_hours

router = APIRouter(prefix="/bidding", tags=["bidding"])


async def _get_pilot_current_group(db: AsyncSession, pilot_id: int) -> Optional[LiveFlyingGroup]:
    """Helper to get pilot's current active assigned flying group."""
    res = await db.execute(
        select(LiveFlyingGroup)
        .join(LiveGroupPilot, LiveGroupPilot.group_id == LiveFlyingGroup.id)
        .where(
            LiveGroupPilot.pilot_id == pilot_id,
            LiveGroupPilot.removed_at.is_(None),
            LiveFlyingGroup.is_active == 1,
        )
    )
    return res.scalar_one_or_none()


async def _is_path_switch_required(db: AsyncSession, pilot_id: int, target_group: LiveFlyingGroup) -> bool:
    """
    Determines if moving to target_group requires an Airbus <-> Boeing path switch.
    Checks fleet type of pilot's current group vs target group.
    """
    current_group = await _get_pilot_current_group(db, pilot_id)
    if not current_group:
        current_path_name = ""
    else:
        current_path_name = current_group.name.lower()

    target_path_name = target_group.name.lower()

    # Path switch happens if one is Airbus and the other is Boeing
    if ("airbus" in current_path_name and "boeing" in target_path_name) or (
        "boeing" in current_path_name and "airbus" in target_path_name
    ):
        return True

    return False


@router.get("/sessions", response_model=List[BiddingSessionOut])
async def list_bidding_sessions(
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    """List all open and past bidding sessions."""
    staff_res = await db.execute(select(StaffRole).where(StaffRole.user_id == pilot.id))
    is_staff = staff_res.scalar_one_or_none() is not None

    stmt = (
        select(LiveBiddingSession)
        .options(
            joinedload(LiveBiddingSession.group),
            joinedload(LiveBiddingSession.creator),
        )
        .order_by(LiveBiddingSession.closes_at.desc())
    )
    result = await db.execute(stmt)
    sessions = list(result.scalars().all())

    out = []
    for s in sessions:
        # Check if session auto-closed by timer
        if s.status == "open" and s.closes_at <= datetime.utcnow():
            s.status = "under_review"
            await db.commit()

        # Count applicants
        app_count_res = await db.execute(
            select(func.count(LiveBiddingApplicant.id)).where(
                LiveBiddingApplicant.session_id == s.id,
                LiveBiddingApplicant.status != "withdrawn",
            )
        )
        app_count = app_count_res.scalar() or 0

        # Check current pilot's bid status
        my_bid_res = await db.execute(
            select(LiveBiddingApplicant).where(
                LiveBiddingApplicant.session_id == s.id,
                LiveBiddingApplicant.pilot_id == pilot.id,
            )
        )
        my_bid = my_bid_res.scalar_one_or_none()
        user_status = my_bid.status if my_bid else None

        # Check path switch required for this pilot
        path_switch_req = await _is_path_switch_required(db, pilot.id, s.group) if s.group else False

        applicants_out = None
        # Include detailed applicants list if staff or if viewing
        if is_staff:
            app_stmt = (
                select(LiveBiddingApplicant)
                .options(joinedload(LiveBiddingApplicant.pilot))
                .where(LiveBiddingApplicant.session_id == s.id)
            )
            app_res = await db.execute(app_stmt)
            applicants = list(app_res.scalars().all())
            applicants_out = []
            for a in applicants:
                curr_grp = await _get_pilot_current_group(db, a.pilot_id)
                h_data = await calculate_pilot_booking_hours(db, a.pilot_id)
                applicants_out.append(
                    BiddingApplicantOut(
                        id=a.id,
                        session_id=a.session_id,
                        pilot_id=a.pilot_id,
                        pilot_callsign=a.pilot.callsign if a.pilot else f"QR{a.pilot_id}",
                        pilot_name=a.pilot.name if a.pilot else None,
                        current_group_name=curr_grp.name if curr_grp else "None",
                        path_switch_required=a.path_switch_required,
                        bidding_fee_paid=a.bidding_fee_paid,
                        path_switch_fee_paid=a.path_switch_fee_paid,
                        status=a.status,
                        applied_at=str(a.applied_at),
                        reviewed_at=str(a.reviewed_at) if a.reviewed_at else None,
                        admin_notes=a.admin_notes,
                        hours_breakdown=ApplicantHours(
                            full_book_hours=h_data["full_book_hours"],
                            only_dep_hours=h_data["only_dep_hours"],
                            only_arri_hours=h_data["only_arri_hours"],
                            total_hours=h_data["total_hours"],
                        ),
                    )
                )

        out.append(
            BiddingSessionOut(
                id=s.id,
                group_id=s.group_id,
                group_name=s.group.name if s.group else f"Group {s.group_id}",
                slots_offered=s.slots_offered,
                bidding_fee_qar=s.bidding_fee_qar,
                path_switch_fee_qar=s.path_switch_fee_qar,
                status=s.status,
                opens_at=str(s.opens_at),
                closes_at=str(s.closes_at),
                created_by=s.created_by,
                creator_callsign=s.creator.callsign if s.creator else None,
                notes=s.notes,
                applicant_count=app_count,
                user_applicant_status=user_status,
                user_path_switch_required=path_switch_req,
                applicants=applicants_out,
            )
        )

    return out


@router.post("/sessions", response_model=BiddingSessionOut)
async def create_bidding_session(
    data: BiddingSessionCreate,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    """Create a new 4-day (or custom duration) fleet bidding session."""
    grp_res = await db.execute(select(LiveFlyingGroup).where(LiveFlyingGroup.id == data.group_id))
    group = grp_res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Flying group not found")

    closes_at = datetime.utcnow() + timedelta(days=data.duration_days)

    session = LiveBiddingSession(
        group_id=data.group_id,
        slots_offered=data.slots_offered,
        bidding_fee_qar=data.bidding_fee_qar,
        path_switch_fee_qar=data.path_switch_fee_qar,
        status="open",
        opens_at=datetime.utcnow(),
        closes_at=closes_at,
        created_by=staff.id,
        notes=data.notes,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return BiddingSessionOut(
        id=session.id,
        group_id=session.group_id,
        group_name=group.name,
        slots_offered=session.slots_offered,
        bidding_fee_qar=session.bidding_fee_qar,
        path_switch_fee_qar=session.path_switch_fee_qar,
        status=session.status,
        opens_at=str(session.opens_at),
        closes_at=str(session.closes_at),
        created_by=session.created_by,
        creator_callsign=staff.callsign,
        notes=session.notes,
        applicant_count=0,
    )


@router.post("/sessions/{session_id}/apply")
async def apply_for_bidding(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    """Submit a bid for an open bidding session."""
    res = await db.execute(select(LiveBiddingSession).where(LiveBiddingSession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Bidding session not found")

    if session.status != "open" or session.closes_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="This bidding session is closed or under review.")

    # Check existing bid
    existing_res = await db.execute(
        select(LiveBiddingApplicant).where(
            LiveBiddingApplicant.session_id == session_id,
            LiveBiddingApplicant.pilot_id == pilot.id,
        )
    )
    existing = existing_res.scalar_one_or_none()
    if existing and existing.status != "withdrawn":
        raise HTTPException(status_code=400, detail="You have already submitted a bid for this session.")

    # Check path switch requirement
    grp_res = await db.execute(select(LiveFlyingGroup).where(LiveFlyingGroup.id == session.group_id))
    target_group = grp_res.scalar_one_or_none()
    path_switch_req = await _is_path_switch_required(db, pilot.id, target_group)

    bidding_fee = session.bidding_fee_qar
    path_switch_fee = session.path_switch_fee_qar if path_switch_req else 0
    total_cost = bidding_fee + path_switch_fee

    # Currency check
    cur_res = await db.execute(select(LiveCurrency).where(LiveCurrency.pilot_id == pilot.id))
    currency = cur_res.scalar_one_or_none()
    if not currency or currency.balance < total_cost:
        curr_bal = currency.balance if currency else 0
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Total required: {total_cost:,.0f} QAR (Bidding: {bidding_fee:,.0f} QAR, Path Switch: {path_switch_fee:,.0f} QAR). Your balance: {curr_bal:,.0f} QAR.",
        )

    # Deduct currency
    currency.balance -= total_cost
    currency.total_spent += total_cost

    # Create transactions
    t1 = LiveCurrencyTransaction(
        pilot_id=pilot.id,
        amount=-bidding_fee,
        transaction_type="bidding_fee",
        reference_id=session.id,
        description=f"Entry fee for Bidding Session #{session.id} ({target_group.name})",
    )
    db.add(t1)

    if path_switch_fee > 0:
        t2 = LiveCurrencyTransaction(
            pilot_id=pilot.id,
            amount=-path_switch_fee,
            transaction_type="path_switch_fee",
            reference_id=session.id,
            description=f"Path Switch fee (Airbus <-> Boeing) for Bidding Session #{session.id}",
        )
        db.add(t2)

    # Add or reactivate applicant record
    if existing:
        existing.status = "submitted"
        existing.path_switch_required = path_switch_req
        existing.bidding_fee_paid = bidding_fee
        existing.path_switch_fee_paid = path_switch_fee
        existing.applied_at = datetime.utcnow()
    else:
        applicant = LiveBiddingApplicant(
            session_id=session.id,
            pilot_id=pilot.id,
            path_switch_required=path_switch_req,
            bidding_fee_paid=bidding_fee,
            path_switch_fee_paid=path_switch_fee,
            status="submitted",
        )
        db.add(applicant)

    await db.commit()
    return {"detail": "Bid successfully submitted!", "balance": currency.balance}


@router.post("/sessions/{session_id}/withdraw")
async def withdraw_bidding(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    """Withdraw bid before session close. Refunds 50% bidding fee + 100% path switch fee."""
    res = await db.execute(select(LiveBiddingSession).where(LiveBiddingSession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Bidding session not found")

    if session.status != "open" or session.closes_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Cannot withdraw: Session is already closed or under review.")

    app_res = await db.execute(
        select(LiveBiddingApplicant).where(
            LiveBiddingApplicant.session_id == session_id,
            LiveBiddingApplicant.pilot_id == pilot.id,
            LiveBiddingApplicant.status == "submitted",
        )
    )
    applicant = app_res.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Active bid not found for this session.")

    # Calculate refunds
    bid_fee_refund = int(applicant.bidding_fee_paid * 0.5)  # 50% refund
    path_switch_refund = applicant.path_switch_fee_paid      # 100% refund
    total_refund = bid_fee_refund + path_switch_refund

    # Refund currency
    cur_res = await db.execute(select(LiveCurrency).where(LiveCurrency.pilot_id == pilot.id))
    currency = cur_res.scalar_one_or_none()
    if currency:
        currency.balance += total_refund

    if bid_fee_refund > 0:
        db.add(
            LiveCurrencyTransaction(
                pilot_id=pilot.id,
                amount=bid_fee_refund,
                transaction_type="bidding_fee_refund",
                reference_id=session.id,
                description=f"50% Bidding fee refund for early withdrawal from Session #{session.id}",
            )
        )

    if path_switch_refund > 0:
        db.add(
            LiveCurrencyTransaction(
                pilot_id=pilot.id,
                amount=path_switch_refund,
                transaction_type="path_switch_fee_refund",
                reference_id=session.id,
                description=f"100% Path switch fee refund for early withdrawal from Session #{session.id}",
            )
        )

    applicant.status = "withdrawn"
    await db.commit()

    return {"detail": "Bid withdrawn successfully.", "refunded_qar": total_refund, "balance": currency.balance if currency else 0}


@router.post("/sessions/{session_id}/finalize")
async def finalize_bidding_session(
    session_id: int,
    data: FinalizeBiddingRequest,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    """
    Staff Finalize Bidding Round:
    - Awards slots to winner_pilot_ids
    - Transfers winners to target group
    - Rejects other active applicants
    - Refunds 100% path switch fee to non-winners
    - Closes bidding session
    """
    s_res = await db.execute(select(LiveBiddingSession).where(LiveBiddingSession.id == session_id))
    session = s_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Bidding session not found")

    if session.status == "closed":
        raise HTTPException(status_code=400, detail="Bidding session is already finalized and closed.")

    grp_res = await db.execute(select(LiveFlyingGroup).where(LiveFlyingGroup.id == session.group_id))
    target_group = grp_res.scalar_one_or_none()

    # Get all submitted applicants
    app_res = await db.execute(
        select(LiveBiddingApplicant).where(
            LiveBiddingApplicant.session_id == session_id,
            LiveBiddingApplicant.status == "submitted",
        )
    )
    applicants = list(app_res.scalars().all())

    for applicant in applicants:
        applicant.reviewed_at = datetime.utcnow()
        applicant.reviewed_by = staff.id
        applicant.admin_notes = data.admin_notes

        if applicant.pilot_id in data.winner_pilot_ids:
            # AWARD WINNER
            applicant.status = "awarded"

            # Execute Group Transfer
            # Deactivate previous active groups
            old_grps = await db.execute(
                select(LiveGroupPilot).where(
                    LiveGroupPilot.pilot_id == applicant.pilot_id,
                    LiveGroupPilot.removed_at.is_(None),
                )
            )
            for og in old_grps.scalars().all():
                og.removed_at = datetime.utcnow()

            # Add to new target group
            db.add(LiveGroupPilot(group_id=target_group.id, pilot_id=applicant.pilot_id))

            # Record transfer log
            db.add(
                LiveTransfer(
                    pilot_id=applicant.pilot_id,
                    transfer_type="group_switch",
                    from_value="Bidding System",
                    to_value=target_group.name,
                    reason=f"Awarded vacancy slot in Bidding Session #{session.id}",
                    status="approved",
                    fee_paid_qar=applicant.bidding_fee_paid + applicant.path_switch_fee_paid,
                    reviewed_by=staff.id,
                    reviewed_at=datetime.utcnow(),
                )
            )
        else:
            # REJECT APPLICANT
            applicant.status = "rejected"

            # Refund 100% path switch fee if paid
            if applicant.path_switch_fee_paid > 0:
                cur_res = await db.execute(select(LiveCurrency).where(LiveCurrency.pilot_id == applicant.pilot_id))
                currency = cur_res.scalar_one_or_none()
                if currency:
                    currency.balance += applicant.path_switch_fee_paid

                db.add(
                    LiveCurrencyTransaction(
                        pilot_id=applicant.pilot_id,
                        amount=applicant.path_switch_fee_paid,
                        transaction_type="path_switch_fee_refund",
                        reference_id=session.id,
                        description=f"100% Path switch fee refund (unsuccessful bid on Session #{session.id})",
                    )
                )

    session.status = "closed"
    await db.commit()

    return {"detail": f"Bidding Session #{session.id} finalized successfully. {len(data.winner_pilot_ids)} pilot(s) awarded slots."}


@router.post("/sessions/{session_id}/cancel")
async def cancel_bidding_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    """
    Staff Cancel Bidding Round:
    - Marks session status as 'cancelled'
    - Refunds 100% of bidding fee and path switch fee to ALL active applicants
    """
    s_res = await db.execute(select(LiveBiddingSession).where(LiveBiddingSession.id == session_id))
    session = s_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Bidding session not found")

    if session.status in ["closed", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Bidding session is already {session.status}.")

    # Get all active applicants
    app_res = await db.execute(
        select(LiveBiddingApplicant).where(
            LiveBiddingApplicant.session_id == session_id,
            LiveBiddingApplicant.status == "submitted",
        )
    )
    applicants = list(app_res.scalars().all())

    for applicant in applicants:
        applicant.reviewed_at = datetime.utcnow()
        applicant.reviewed_by = staff.id
        applicant.status = "withdrawn"
        applicant.admin_notes = "Session cancelled by staff."

        total_refund = applicant.bidding_fee_paid + applicant.path_switch_fee_paid

        if total_refund > 0:
            cur_res = await db.execute(select(LiveCurrency).where(LiveCurrency.pilot_id == applicant.pilot_id))
            currency = cur_res.scalar_one_or_none()
            if currency:
                currency.balance += total_refund

            if applicant.bidding_fee_paid > 0:
                db.add(
                    LiveCurrencyTransaction(
                        pilot_id=applicant.pilot_id,
                        amount=applicant.bidding_fee_paid,
                        transaction_type="bidding_fee_refund",
                        reference_id=session.id,
                        description=f"100% Bidding fee refund (Session #{session.id} cancelled by staff)",
                    )
                )

            if applicant.path_switch_fee_paid > 0:
                db.add(
                    LiveCurrencyTransaction(
                        pilot_id=applicant.pilot_id,
                        amount=applicant.path_switch_fee_paid,
                        transaction_type="path_switch_fee_refund",
                        reference_id=session.id,
                        description=f"100% Path switch fee refund (Session #{session.id} cancelled by staff)",
                    )
                )

    session.status = "cancelled"
    await db.commit()

    return {"detail": f"Bidding Session #{session.id} cancelled successfully. Refunds issued to {len(applicants)} applicant(s)."}

