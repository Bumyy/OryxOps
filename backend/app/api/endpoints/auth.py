from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_pilot
from app.core.security import create_access_token, verify_password
from app.models.live_models import Pilot
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.pilot_utils import get_pilot_avatar

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select

    result = await db.execute(select(Pilot).where(Pilot.email == request.email))
    pilot = result.scalar_one_or_none()

    if not pilot or not verify_password(request.password, pilot.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(data={"sub": str(pilot.id)})
    return TokenResponse(access_token=token)


@router.get("/me")
async def get_me(
    pilot: Pilot = Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    from app.models.live_models import Permission, StaffRole

    perm_result = await db.execute(
        select(Permission).where(
            Permission.userid == pilot.id,
            Permission.name.in_(["admin", "opsmanage"]),
        ).limit(1)
    )
    has_perm = perm_result.scalar_one_or_none() is not None

    role_result = await db.execute(
        select(StaffRole).where(StaffRole.user_id == pilot.id).limit(1)
    )
    has_role = role_result.scalar_one_or_none() is not None

    is_staff = has_perm or has_role

    return {
        "id": pilot.id,
        "callsign": pilot.callsign,
        "name": pilot.name,
        "email": pilot.email,
        "grade": pilot.grade,
        "transhours": pilot.transhours,
        "transflights": pilot.transflights,
        "discordid": pilot.discordid,
        "status": pilot.status,
        "joined": str(pilot.joined) if pilot.joined else None,
        "avatar": get_pilot_avatar(pilot),
        "is_staff": is_staff,
    }
