from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.live_models import LiveTokens, LiveTokenTransaction


async def get_token_balance(db: AsyncSession, pilot_id: int) -> LiveTokens | None:
    result = await db.execute(
        select(LiveTokens).where(LiveTokens.pilot_id == pilot_id)
    )
    return result.scalar_one_or_none()


async def get_or_create_token_wallet(db: AsyncSession, pilot_id: int) -> LiveTokens:
    wallet = await get_token_balance(db, pilot_id)
    if not wallet:
        wallet = LiveTokens(pilot_id=pilot_id, balance=0, total_earned=0, total_spent=0)
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
    return wallet


async def get_token_transactions(
    db: AsyncSession, pilot_id: int, limit: int = 50, offset: int = 0
) -> list[LiveTokenTransaction]:
    result = await db.execute(
        select(LiveTokenTransaction)
        .where(LiveTokenTransaction.pilot_id == pilot_id)
        .order_by(LiveTokenTransaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def grant_tokens(
    db: AsyncSession,
    pilot_id: int,
    amount: int,
    transaction_type: str = "admin_grant",
    reference_id: int | None = None,
    description: str | None = None,
) -> LiveTokens:
    wallet = await get_or_create_token_wallet(db, pilot_id)
    wallet.balance += amount
    wallet.total_earned += amount

    transaction = LiveTokenTransaction(
        pilot_id=pilot_id,
        amount=amount,
        transaction_type=transaction_type,
        reference_id=reference_id,
        description=description,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(wallet)
    return wallet


async def remove_tokens(
    db: AsyncSession,
    pilot_id: int,
    amount: int,
    transaction_type: str = "admin_remove",
    reference_id: int | None = None,
    description: str | None = None,
) -> LiveTokens | None:
    wallet = await get_token_balance(db, pilot_id)
    if not wallet or wallet.balance < amount:
        return None

    wallet.balance -= amount
    wallet.total_spent += amount

    transaction = LiveTokenTransaction(
        pilot_id=pilot_id,
        amount=-amount,
        transaction_type=transaction_type,
        reference_id=reference_id,
        description=description,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(wallet)
    return wallet


async def spend_tokens(
    db: AsyncSession,
    pilot_id: int,
    amount: int,
    transaction_type: str = "booking_spend",
    reference_id: int | None = None,
    description: str | None = None,
) -> LiveTokens | None:
    wallet = await get_token_balance(db, pilot_id)
    if not wallet or wallet.balance < amount:
        return None

    wallet.balance -= amount
    wallet.total_spent += amount

    transaction = LiveTokenTransaction(
        pilot_id=pilot_id,
        amount=-amount,
        transaction_type=transaction_type,
        reference_id=reference_id,
        description=description,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(wallet)
    return wallet
