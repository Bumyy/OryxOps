from pydantic import BaseModel


class SettingOut(BaseModel):
    setting_key: str
    setting_value: str
    description: str | None = None

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    setting_value: str
