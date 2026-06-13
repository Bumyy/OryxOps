from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_staff
from app.models.live_models import LiveSetting, Pilot
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
    staff: Pilot = Depends(get_current_staff),
):
    result = await db.execute(select(LiveSetting).where(LiveSetting.setting_key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    setting.setting_value = data.setting_value
    await db.commit()
    await db.refresh(setting)
    return SettingOut(setting_key=setting.setting_key, setting_value=setting.setting_value, description=setting.description)
