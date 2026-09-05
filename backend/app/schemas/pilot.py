from pydantic import BaseModel


class PilotOut(BaseModel):
    id: int
    callsign: str
    name: str
    grade: int | None = None
    transhours: int
    transflights: int
    status: int
    joined: str | None = None
    lifts: int = 0

    model_config = {"from_attributes": True}


class PilotListOut(BaseModel):
    id: int
    callsign: str
    name: str
    grade: int | None = None
    group_name: str | None = None

    model_config = {"from_attributes": True}


class PilotDetailOut(PilotOut):
    group_name: str | None = None
    group_id: int | None = None
    token_balance: int = 0

    model_config = {"from_attributes": True}
