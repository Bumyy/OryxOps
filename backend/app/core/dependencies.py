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
    from app.models.live_models import Permission

    result = await db.execute(
        select(Permission).where(
            Permission.userid == pilot.id,
            Permission.name.in_(["admin", "opsmanage"]),
        ).limit(1)
    )
    perm = result.scalar_one_or_none()
    if perm is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")
    return pilot


def get_current_admin(pilot=Depends(get_current_staff)):
    return pilot
