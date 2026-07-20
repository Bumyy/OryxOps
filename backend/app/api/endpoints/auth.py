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
    from app.models.live_models import Permission, AwardGranted

    clean_callsign = pilot.callsign.strip().upper() if pilot.callsign else ""
    is_executive = clean_callsign in ["QRV001", "QRV002", "QRV003", "QRV004"]

    # Executive priority check: full access to everything automatically
    if is_executive:
        is_admin = True
        has_award_9 = True
        has_pilot_access = True
    else:
        # Check Admin permission in permissions table
        perm_res = await db.execute(
            select(Permission).where(
                Permission.userid == pilot.id,
                Permission.name == "admin",
            ).limit(1)
        )
        is_admin = perm_res.scalar_one_or_none() is not None

        # Check Award 9 in awards_granted table
        award_res = await db.execute(
            select(AwardGranted).where(
                AwardGranted.pilotid == pilot.id,
                AwardGranted.awardid == 9,
            ).limit(1)
        )
        has_award_9 = award_res.scalar_one_or_none() is not None
        has_pilot_access = has_award_9 or is_admin

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
        "is_executive": is_executive,
        "is_admin": is_admin,
        "has_award_9": has_award_9,
        "has_pilot_access": has_pilot_access,
        "simbrief_id": pilot.simbrief_id,
    }

