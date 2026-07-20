from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_staff, get_current_pilot
from app.models.live_models import LiveSetting, Pilot, Permission
from app.schemas.settings import SettingOut, SettingUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=list[SettingOut])
async def list_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LiveSetting))
    settings = list(result.scalars().all())
    return [SettingOut(setting_key=s.setting_key, setting_value=s.setting_value, description=s.description) for s in settings]


@router.get("/{key}", response_model=SettingOut)
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LiveSetting).where(LiveSetting.setting_key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return SettingOut(setting_key=setting.setting_key, setting_value=setting.setting_value, description=setting.description)


@router.patch("/{key}", response_model=SettingOut)
async def update_setting(
    key: str,
    data: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    pilot: Pilot = Depends(get_current_pilot),
):
    # Security authorization check
    is_rate_setting = key.startswith("econ_") or key.startswith("repu_")
    if is_rate_setting:
        if not (pilot.callsign and pilot.callsign.upper() in ["QRV001", "QRV002", "QRV003", "QRV004"]):
            raise HTTPException(status_code=403, detail="Only QRV001 to QRV004 can update rate settings")
    else:
        # Check standard admin permission
        result = await db.execute(
            select(Permission).where(
                Permission.userid == pilot.id,
                Permission.name == "admin",
            ).limit(1)
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(LiveSetting).where(LiveSetting.setting_key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    setting.setting_value = data.setting_value
    await db.commit()
    await db.refresh(setting)
    return SettingOut(setting_key=setting.setting_key, setting_value=setting.setting_value, description=setting.description)
