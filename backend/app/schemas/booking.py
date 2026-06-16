from pydantic import BaseModel


class BookingOut(BaseModel):
    id: int
    schedule_id: int
    pilot_id: int
    pilot_callsign: str | None = None
    pilot_avatar: str | None = None
    token_cost: int
    booked_at: str
    status: str
    completed_pirep_id: int | None = None
    taken_over_by: int | None = None
    taken_over_by_name: str | None = None
    taken_over_at: str | None = None
    flight_departure: str | None = None
    flight_arrival: str | None = None
    flight_scheduled_dep: str | None = None
    aircraft_registration: str | None = None

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    schedule_id: int


class BookingComplete(BaseModel):
    pirep_id: int
