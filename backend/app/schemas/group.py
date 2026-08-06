from pydantic import BaseModel


class FlyingGroupOut(BaseModel):
    id: int
    name: str
    discord_channel_id: str | None = None
    is_active: bool
    period_start: str
    period_end: str
    member_count: int = 0
    aircraft_count: int = 0
    max_slots: int = 2
    available_slots: int = 2
    is_full: bool = False

    model_config = {"from_attributes": True}


class FlyingGroupCreate(BaseModel):
    name: str
    discord_channel_id: str | None = None
    period_start: str
    period_end: str


class FlyingGroupUpdate(BaseModel):
    name: str | None = None
    discord_channel_id: str | None = None
    is_active: bool | None = None


class GroupPilotOut(BaseModel):
    id: int
    pilot_id: int
    pilot_callsign: str | None = None
    pilot_name: str | None = None
    is_group_admin: bool
    assigned_at: str | None = None

    model_config = {"from_attributes": True}


class GroupAircraftOut(BaseModel):
    id: int
    aircraft_id: int
    aircraft_type_id: int | None = None
    registration: str | None = None
    aircraft_type_name: str | None = None
    current_airport: str | None = None
    status: str | None = None
    assigned_at: str | None = None
    assigned_captain_id: int | None = None
    assigned_captain_name: str | None = None
    assigned_captain_callsign: str | None = None
    assigned_captain_avatar: str | None = None
    assigned_captain_hours: float = 0.0
    assigned_fo_id: int | None = None
    assigned_fo_name: str | None = None
    assigned_fo_callsign: str | None = None
    assigned_fo_avatar: str | None = None
    assigned_fo_hours: float = 0.0

    model_config = {"from_attributes": True}


class GroupDetailOut(FlyingGroupOut):
    members: list[GroupPilotOut] = []
    aircraft: list[GroupAircraftOut] = []


class AssignPilotsRequest(BaseModel):
    pilot_ids: list[int]
    is_group_admin: bool = False


class AssignAircraftRequest(BaseModel):
    aircraft_ids: list[int]


class ToggleAdminRequest(BaseModel):
    is_group_admin: bool
