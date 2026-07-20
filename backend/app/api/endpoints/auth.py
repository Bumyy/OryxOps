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
@router.get("/me/")
async def get_me(
    pilot: Pilot = Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    from app.models.live_models import Permission, StaffRole, AwardGranted

    clean_callsign = pilot.callsign.strip().upper() if pilot.callsign else ""
    is_executive = clean_callsign in ["QRV001", "QRV002", "QRV003", "QRV004"]

    perm_result = await db.execute(
        select(Permission).where(
            Permission.userid == pilot.id,
        )
    )
    user_perms = [p.name for p in perm_result.scalars().all()]
    is_admin = ("admin" in user_perms) or is_executive
    is_staff = is_admin or ("opsmanage" in user_perms)

    if not is_staff:
        role_res = await db.execute(
            select(StaffRole).where(StaffRole.user_id == pilot.id).limit(1)
        )
        if role_res.scalar_one_or_none() is not None:
            is_staff = True

    award_result = await db.execute(
        select(AwardGranted).where(
            AwardGranted.pilotid == pilot.id,
            AwardGranted.awardid == 9,
        ).limit(1)
    )
    has_award_9 = award_result.scalar_one_or_none() is not None
    has_pilot_access = True  # Registered pilots have access to pilot portal

    return {
        "id": pilot.id,
        "callsign": pilot.callsign.strip() if pilot.callsign else "",
        "name": pilot.name.strip() if pilot.name else "",
        "email": pilot.email,
        "grade": pilot.grade,
        "transhours": pilot.transhours,
        "transflights": pilot.transflights,
        "discordid": pilot.discordid,
        "status": pilot.status,
        "joined": str(pilot.joined) if pilot.joined else None,
        "avatar": get_pilot_avatar(pilot),
        "is_staff": is_staff,
        "is_admin": is_admin,
        "is_executive": is_executive,
        "has_award_9": has_award_9,
        "has_pilot_access": has_pilot_access,
        "simbrief_id": pilot.simbrief_id,
    }
