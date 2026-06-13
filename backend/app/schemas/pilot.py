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

    model_config = {"from_attributes": True}


class PilotListOut(BaseModel):
    id: int
    callsign: str
    name: str
    grade: int | None = None
    group_name: str | None = None
    career_path_names: list[str] = []
    current_ranks: list[str] = []

    model_config = {"from_attributes": True}


class PilotDetailOut(PilotOut):
    group_name: str | None = None
    token_balance: int = 0
    careers: list[dict] = []

    model_config = {"from_attributes": True}
