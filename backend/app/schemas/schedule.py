from pydantic import BaseModel, Field, field_validator


class WaveOut(BaseModel):
    id: int
    name: str
    wave_type: str = "departure"
    departure_window_start: str
    departure_window_end: str

    model_config = {"from_attributes": True}


class WaveCreate(BaseModel):
    group_id: int | None = None
    name: str
    wave_type: str = "departure"
    departure_window_start: str
    departure_window_end: str


class ScheduleOut(BaseModel):
    id: int
    group_id: int | None = None
    aircraft_id: int
    aircraft_registration: str | None = None
    route_id: int | None = None
    departure: str
    arrival: str
    flight_number: str | None = None
    scheduled_departure: str
    scheduled_arrival: str
    wave_id: int | None = None
    wave_name: str | None = None
    ground_time_minutes: int
    status: str
    created_by: int
    created_by_name: str | None = None
    approved_by: int | None = None
    week_start: str
    booking_count: int = 0
    if_schedule_id: str | None = None

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    group_id: int | None = None
    aircraft_id: int
    route_id: int | None = None
    departure: str = Field(..., min_length=4, max_length=4, pattern=r"^[A-Z]{4}$")
    arrival: str = Field(..., min_length=4, max_length=4, pattern=r"^[A-Z]{4}$")
    flight_number: str | None = None
    scheduled_departure: str
    scheduled_arrival: str
    wave_id: int | None = None
    ground_time_minutes: int = 60
    week_start: str

    @field_validator("departure", "arrival", mode="before")
    @classmethod
    def uppercase_icao(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().upper()
        return v


class ScheduleUpdate(BaseModel):
    aircraft_id: int | None = None
    departure: str | None = Field(None, min_length=4, max_length=4, pattern=r"^[A-Z]{4}$")
    arrival: str | None = Field(None, min_length=4, max_length=4, pattern=r"^[A-Z]{4}$")
    flight_number: str | None = None
    scheduled_departure: str | None = None
    scheduled_arrival: str | None = None
    wave_id: int | None = None
    ground_time_minutes: int | None = None
    week_start: str | None = None

    @field_validator("departure", "arrival", mode="before")
    @classmethod
    def uppercase_icao_optional(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            return v.strip().upper()
        return v


class ScheduleBulkApprove(BaseModel):
    group_id: int | None = None
    week_start: str


class AutoScheduleRequest(BaseModel):
    group_id: int | None = None
    aircraft_id: int
    num_roundtrips: int
    haul_preference: str
    start_time: str
    min_hours: int | None = 0
    max_hours: int | None = 0
