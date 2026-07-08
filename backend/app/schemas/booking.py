from pydantic import BaseModel


class BookingOut(BaseModel):
    id: int
    schedule_id: int
    pilot_id: int
    pilot_callsign: str | None = None
    pilot_avatar: str | None = None
    booking_type: str = "both"
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
    flight_number: str | None = None
    aircraft_registration: str | None = None
    aircraft_icao: str | None = None

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    schedule_id: int
    booking_type: str = "both"


class BookingComplete(BaseModel):
    pirep_id: int
