from pydantic import BaseModel


class BookingOut(BaseModel):
    id: int
    schedule_id: int
    departure_pilot_id: int | None = None
    departure_pilot_callsign: str | None = None
    departure_pilot_avatar: str | None = None
    arrival_pilot_id: int | None = None
    arrival_pilot_callsign: str | None = None
    arrival_pilot_avatar: str | None = None
    departure_pirep_id: int | None = None
    arrival_pirep_id: int | None = None
    booked_at: str
    dispatched_at: str | None = None
    pax_count: int | None = None
    landing_fpm: int | None = None
    reputation_score: float | None = None
    earnings: float | None = None
    expenses: float | None = None
    status: str
    pirep_accepted: int | None = None
    flight_time_minutes: int | None = None
    fuel_burned: float | None = None
    scheduled_duration_minutes: int | None = None
    
    # Flight/Schedule details
    flight_departure: str | None = None
    flight_arrival: str | None = None
    flight_scheduled_dep: str | None = None
    flight_number: str | None = None
    aircraft_registration: str | None = None
    aircraft_icao: str | None = None
    
    actual_arrival: str | None = None
    diverted: bool = False

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    schedule_id: int
    booking_type: str = "both"  # "departure", "arrival", or "both"


class BookingComplete(BaseModel):
    flight_time_minutes: int
    fuel_burned: float
    landing_fpm: int
    actual_arrival: str | None = None

