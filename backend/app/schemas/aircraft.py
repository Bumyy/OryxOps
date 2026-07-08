from pydantic import BaseModel


class AircraftTypeOut(BaseModel):
    id: int
    name: str
    icao: str
    liveryname: str | None = None

    model_config = {"from_attributes": True}


class LiveAircraftOut(BaseModel):
    id: int
    aircraft_type_id: int
    aircraft_type_name: str | None = None
    registration: str
    if_aircraft_id: str | None = None
    if_organization_aircraft_id: str | None = None
    current_airport: str
    current_parking_id: int | None = None
    status: str
    current_pilot_id: int | None = None
    current_pilot_name: str | None = None
    last_pilot_id: int | None = None
    last_pilot_name: str | None = None
    last_airport: str | None = None
    last_flight_at: str | None = None
    total_flight_hours: int
    total_flights: int
    delivered_at: str | None = None
    home_base: str

    model_config = {"from_attributes": True}


class LiveAircraftDetailOut(LiveAircraftOut):
    current_parking_name: str | None = None
    group_name: str | None = None


class LiveAircraftUpdate(BaseModel):
    status: str | None = None
    current_airport: str | None = None
    current_parking_id: int | None = None
    home_base: str | None = None


class LiveAircraftCreate(BaseModel):
    aircraft_type_id: int
    registration: str
    current_airport: str = "OTHH"
    current_parking_id: int | None = None
    home_base: str = "OTHH"


class LiveAircraftHistoryOut(BaseModel):
    id: int
    flightnum: str | None = None
    departure: str
    arrival: str
    flighttime: int
    pilot_name: str | None = None
    date: str
    fuelused: int

    model_config = {"from_attributes": True}
