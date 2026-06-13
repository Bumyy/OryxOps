from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot, get_current_staff
from app.models.live_models import Pilot
from app.schemas.token import (
    TokenBalanceOut,
    TokenGrantRequest,
    TokenRemoveRequest,
    TokenTransactionOut,
)
from app.services.token_service import (
    get_or_create_token_wallet,
    get_token_balance,
    get_token_transactions,
    grant_tokens,
    remove_tokens,
)

router = APIRouter(prefix="/tokens", tags=["tokens"])


@router.get("/balance", response_model=TokenBalanceOut)
async def get_my_balance(
    pilot: Pilot = Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    wallet = await get_or_create_token_wallet(db, pilot.id)
    return TokenBalanceOut(
        balance=wallet.balance,
        total_earned=wallet.total_earned,
        total_spent=wallet.total_spent,
    )


@router.get("/balance/{pilot_id}", response_model=TokenBalanceOut)
async def get_pilot_balance(
    pilot_id: int,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    wallet = await get_token_balance(db, pilot_id)
    if not wallet:
        return TokenBalanceOut(balance=0, total_earned=0, total_spent=0)
    return TokenBalanceOut(
        balance=wallet.balance,
        total_earned=wallet.total_earned,
        total_spent=wallet.total_spent,
    )


@router.get("/transactions", response_model=list[TokenTransactionOut])
async def get_my_transactions(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    pilot: Pilot = Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    transactions = await get_token_transactions(db, pilot.id, limit, offset)
    return [
        TokenTransactionOut(
            id=t.id,
            amount=t.amount,
            transaction_type=t.transaction_type,
            reference_id=t.reference_id,
            description=t.description,
            created_at=str(t.created_at),
        )
        for t in transactions
    ]


@router.post("/grant", response_model=TokenBalanceOut)
async def grant_tokens_route(
    data: TokenGrantRequest,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    wallet = await grant_tokens(
        db,
        data.pilot_id,
        data.amount,
        transaction_type="admin_grant",
        description=data.description,
    )
    return TokenBalanceOut(
        balance=wallet.balance,
        total_earned=wallet.total_earned,
        total_spent=wallet.total_spent,
    )


@router.post("/remove", response_model=TokenBalanceOut)
async def remove_tokens_route(
    data: TokenRemoveRequest,
    db: AsyncSession = Depends(get_db),
    staff: Pilot = Depends(get_current_staff),
):
    wallet = await remove_tokens(
        db,
        data.pilot_id,
        data.amount,
        transaction_type="admin_remove",
        description=data.description,
    )
    if not wallet:
        raise HTTPException(status_code=400, detail="Insufficient balance or wallet not found")
    return TokenBalanceOut(
        balance=wallet.balance,
        total_earned=wallet.total_earned,
        total_spent=wallet.total_spent,
    )
