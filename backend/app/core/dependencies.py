from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token

security_scheme = HTTPBearer(auto_error=False)


async def get_current_pilot(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.models.live_models import Pilot

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub_val = payload.get("sub")
    if sub_val is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        pilot_id = int(sub_val)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(Pilot).where(Pilot.id == pilot_id))
    pilot = result.scalar_one_or_none()
    if pilot is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Pilot not found")

    return pilot


async def get_current_staff(
    pilot=Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    from app.models.live_models import Permission, StaffRole

    clean_callsign = pilot.callsign.strip().upper() if pilot.callsign else ""
    if clean_callsign in ["QRV001", "QRV002", "QRV003", "QRV004"]:
        return pilot

    result = await db.execute(
        select(Permission).where(
            Permission.userid == pilot.id,
            Permission.name.in_(["admin", "opsmanage"]),
        ).limit(1)
    )
    if result.scalar_one_or_none() is not None:
        return pilot

    role_res = await db.execute(
        select(StaffRole).where(StaffRole.user_id == pilot.id).limit(1)
    )
    if role_res.scalar_one_or_none() is not None:
        return pilot

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")


async def get_current_admin(
    pilot=Depends(get_current_pilot),
    db: AsyncSession = Depends(get_db),
):
    from app.models.live_models import Permission

    clean_callsign = pilot.callsign.strip().upper() if pilot.callsign else ""
    if clean_callsign in ["QRV001", "QRV002", "QRV003", "QRV004"]:
        return pilot

    result = await db.execute(
        select(Permission).where(
            Permission.userid == pilot.id,
            Permission.name == "admin",
        ).limit(1)
    )
    if result.scalar_one_or_none() is not None:
        return pilot

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
