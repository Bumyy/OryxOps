from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PilotBasic(BaseModel):
    id: int
    callsign: str
    name: str
    grade: int | None = None

    model_config = {"from_attributes": True}


class PilotMeResponse(BaseModel):
    id: int
    callsign: str
    name: str
    email: str
    grade: int | None = None
    transhours: int
    transflights: int
    discordid: str | None = None
    status: int
    joined: str | None = None

    model_config = {"from_attributes": True}
