import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    Boolean,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ============================================================
# EXISTING TABLES (referenced by live_* tables)
# ============================================================

class Pilot(Base):
    __tablename__ = "pilots"

    id = Column(Integer, primary_key=True)
    callsign = Column(String(120))
    name = Column(Text)
    ifc = Column(Text)
    ifuserid = Column(String(36))
    discordid = Column(String(30))
    email = Column(Text)
    password = Column(Text)
    transhours = Column(Integer, default=0)
    transflights = Column(Integer, default=0)
    violand = Column(Float)
    grade = Column(Integer)
    notes = Column(String(1200), default="")
    status = Column(Integer, default=0)
    joined = Column(DateTime, default=datetime.utcnow)
    vanet_id = Column(Text)
    vanet_accesstoken = Column(Text)
    vanet_refreshtoken = Column(Text)
    vanet_expiry = Column(DateTime)
    vanet_memberid = Column(Text)
    cargo_coins = Column(Integer, default=0)
    flying_groupid = Column(Integer, default=0)
    flying_group_airport = Column(String(4), default="OTHH")
    simbrief_id = Column(Integer)
    lifts = Column(Integer, default=0)


class Aircraft(Base):
    __tablename__ = "aircraft"

    id = Column(Integer, primary_key=True)
    name = Column(Text)
    ifaircraftid = Column(Text)
    liveryname = Column(Text)
    ifliveryid = Column(Text)
    notes = Column(String(12))
    rankreq = Column(Integer)
    awardreq = Column(Integer)
    status = Column(Integer, default=0)
    codeshare = Column(Integer, default=1)
    icao = Column(String(4), default="XXXX")


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True)
    fltnum = Column(Text)
    dep = Column(String(4))
    arr = Column(String(4))
    duration = Column(Integer)
    notes = Column(Text)
    multiplier = Column(Float, default=1.0)
    flown = Column(Integer, default=0)
    featured = Column(Integer, default=0)
    codeshare = Column(Integer, default=0)


class RouteAircraft(Base):
    __tablename__ = "route_aircraft"

    id = Column(Integer, primary_key=True)
    routeid = Column(Integer, ForeignKey("routes.id"))
    aircraftid = Column(Integer, ForeignKey("aircraft.id"))


class Pirep(Base):
    __tablename__ = "pireps"

    id = Column(Integer, primary_key=True)
    flightnum = Column(Text)
    departure = Column(String(4))
    arrival = Column(String(4))
    flighttime = Column(Integer)
    pilotid = Column(Integer, ForeignKey("pilots.id"))
    date = Column(Date)
    aircraftid = Column(Integer, ForeignKey("aircraft.id"))
    fuelused = Column(Integer)
    multi = Column(Text)
    status = Column(Integer, default=0)
    acceptedid = Column(Integer, default=0)
    challengeid = Column(Integer, default=0)
    trackedaircraftid = Column(Integer, default=0)

    pilot = relationship("Pilot", foreign_keys=[pilotid])


class ParkingPosition(Base):
    __tablename__ = "parking_positions"

    id = Column(Integer, primary_key=True)
    airport = Column(String(4))
    name = Column(String(64))
    latitude = Column(Float, default=0)
    longitude = Column(Float, default=0)
    heading = Column(Float, default=0)


class StaffRole(Base):
    __tablename__ = "staff_roles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("pilots.id"))
    level = Column(Enum("Executive", "Manager", "Staff"))
    role_name = Column(String(255))


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True)
    name = Column(String(120))
    userid = Column(Integer, ForeignKey("pilots.id"))


# ============================================================
# LIVE MODE TABLES
# ============================================================

class LiveCareerPath(Base):
    __tablename__ = "live_career_paths"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    description = Column(Text)
    is_active = Column(Integer, nullable=False, default=1)

    ranks = relationship("LiveCareerRank", back_populates="career_path")
    pilot_careers = relationship("LivePilotCareer", back_populates="career_path")


class LiveCareerRank(Base):
    __tablename__ = "live_career_ranks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    career_path_id = Column(Integer, ForeignKey("live_career_paths.id"), nullable=False)
    name = Column(String(50), nullable=False)
    sort_order = Column(Integer, nullable=False)
    required_route_pct = Column(Numeric(5, 2), nullable=False, default=0)
    required_takeoffs = Column(Integer, nullable=False, default=0)
    required_landings = Column(Integer, nullable=False, default=0)
    weekly_proposal_limit = Column(Integer, nullable=False, default=3)

    career_path = relationship("LiveCareerPath", back_populates="ranks")
    rank_aircraft = relationship("LiveCareerRankAircraft", back_populates="career_rank")


class LiveCareerRankAircraft(Base):
    __tablename__ = "live_career_rank_aircraft"

    id = Column(Integer, primary_key=True, autoincrement=True)
    career_rank_id = Column(Integer, ForeignKey("live_career_ranks.id"), nullable=False)
    aircraft_type_id = Column(Integer, ForeignKey("aircraft.id"), nullable=False)
    count = Column(Integer, nullable=False, default=1)

    career_rank = relationship("LiveCareerRank", back_populates="rank_aircraft")
    aircraft_type = relationship("Aircraft", foreign_keys=[aircraft_type_id])


class LivePilotCareer(Base):
    __tablename__ = "live_pilot_careers"
    __table_args__ = (UniqueConstraint("pilot_id", "career_path_id", name="uk_pilot_path"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=False)
    career_path_id = Column(Integer, ForeignKey("live_career_paths.id"), nullable=False)
    current_rank_id = Column(Integer, ForeignKey("live_career_ranks.id"), nullable=False)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    promoted_at = Column(DateTime)
    previous_rank_id = Column(Integer, ForeignKey("live_career_ranks.id"))
    selected_aircraft_ids = Column(String(255), nullable=True)

    pilot = relationship("Pilot", foreign_keys=[pilot_id])
    career_path = relationship("LiveCareerPath", back_populates="pilot_careers")
    current_rank = relationship("LiveCareerRank", foreign_keys=[current_rank_id])
    previous_rank = relationship("LiveCareerRank", foreign_keys=[previous_rank_id])


class LiveAircraft(Base):
    __tablename__ = "live_aircraft"

    id = Column(Integer, primary_key=True, autoincrement=True)
    aircraft_type_id = Column(Integer, ForeignKey("aircraft.id"), nullable=False)
    registration = Column(String(10), nullable=False, unique=True)
    if_aircraft_id = Column(String(36))
    if_organization_aircraft_id = Column(String(36))
    current_airport = Column(String(4), nullable=False, default="OTHH")
    current_parking_id = Column(Integer, ForeignKey("parking_positions.id"))
    status = Column(
        Enum("parked", "flying", "maintenance", "in_hangar", name="aircraft_status"),
        nullable=False,
        default="parked",
    )
    current_pilot_id = Column(Integer, ForeignKey("pilots.id"))
    current_pirep_id = Column(Integer, ForeignKey("pireps.id"))
    last_pilot_id = Column(Integer, ForeignKey("pilots.id"))
    last_airport = Column(String(4))
    last_flight_at = Column(DateTime)
    total_flight_hours = Column(Integer, nullable=False, default=0)
    total_flights = Column(Integer, nullable=False, default=0)
    delivered_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    home_base = Column(String(4), nullable=False, default="OTHH")
    assigned_captain_id = Column(Integer, ForeignKey("pilots.id"), nullable=True)
    assigned_fo_id = Column(Integer, ForeignKey("pilots.id"), nullable=True)

    aircraft_type = relationship("Aircraft", foreign_keys=[aircraft_type_id])
    current_parking = relationship("ParkingPosition", foreign_keys=[current_parking_id])
    current_pilot = relationship("Pilot", foreign_keys=[current_pilot_id])
    current_pirep = relationship("Pirep", foreign_keys=[current_pirep_id])
    last_pilot = relationship("Pilot", foreign_keys=[last_pilot_id])
    assigned_captain = relationship("Pilot", foreign_keys=[assigned_captain_id])
    assigned_fo = relationship("Pilot", foreign_keys=[assigned_fo_id])

    group_assignments = relationship("LiveGroupAircraft", back_populates="aircraft")
    flight_schedules = relationship("LiveFlightSchedule", back_populates="aircraft")


class LiveRouteDiscovery(Base):
    __tablename__ = "live_route_discovery"
    __table_args__ = (
        UniqueConstraint("pilot_id", "aircraft_type_id", "departure", "arrival", name="uk_pilot_aircraft_route"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=False)
    aircraft_type_id = Column(Integer, ForeignKey("aircraft.id"), nullable=False)
    route_id = Column(Integer, ForeignKey("routes.id"))
    departure = Column(String(4), nullable=False)
    arrival = Column(String(4), nullable=False)
    flown_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    pirep_id = Column(Integer, ForeignKey("pireps.id"))

    pilot = relationship("Pilot", foreign_keys=[pilot_id])
    aircraft_type = relationship("Aircraft", foreign_keys=[aircraft_type_id])
    route = relationship("Route", foreign_keys=[route_id])
    pirep = relationship("Pirep", foreign_keys=[pirep_id])


class LiveFlyingGroup(Base):
    __tablename__ = "live_flying_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), nullable=False)
    discord_channel_id = Column(String(30))
    is_active = Column(Integer, nullable=False, default=1)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    group_pilots = relationship("LiveGroupPilot", back_populates="group")
    group_aircraft = relationship("LiveGroupAircraft", back_populates="group")
    waves = relationship("LiveScheduleWave", back_populates="group")
    flight_schedules = relationship("LiveFlightSchedule", back_populates="group")


class LiveGroupPilot(Base):
    __tablename__ = "live_group_pilots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("live_flying_groups.id"), nullable=False)
    pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=False)
    is_group_admin = Column(Integer, nullable=False, default=0)
    assigned_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    removed_at = Column(DateTime)

    group = relationship("LiveFlyingGroup", back_populates="group_pilots")
    pilot = relationship("Pilot", foreign_keys=[pilot_id])


class LiveGroupAircraft(Base):
    __tablename__ = "live_group_aircraft"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("live_flying_groups.id"), nullable=False)
    aircraft_id = Column(Integer, ForeignKey("live_aircraft.id"), nullable=False)
    assigned_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    removed_at = Column(DateTime)

    group = relationship("LiveFlyingGroup", back_populates="group_aircraft")
    aircraft = relationship("LiveAircraft", back_populates="group_assignments")


class LiveCurrency(Base):
    __tablename__ = "live_currency"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=False, unique=True)
    balance = Column(Integer, nullable=False, default=0)
    total_earned = Column(Integer, nullable=False, default=0)
    total_spent = Column(Integer, nullable=False, default=0)

    pilot = relationship("Pilot", foreign_keys=[pilot_id])


class LiveCurrencyTransaction(Base):
    __tablename__ = "live_currency_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    transaction_type = Column(
        Enum(
            "flight_completed",
            "takeoff",
            "landing",
            "lift_boost",
            "admin_grant",
            "admin_remove",
            "booking_spend",
            "no_show_penalty",
            "extra_proposal_slot",
            "path_switch_fee",
            "aircraft_switch_fee",
            "bidding_fee",
            "bidding_fee_refund",
            "path_switch_fee_refund",
            name="transaction_type",
        ),
        nullable=False,
    )
    reference_id = Column(Integer)
    description = Column(String(255))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    pilot = relationship("Pilot", foreign_keys=[pilot_id])


class LiveScheduleWave(Base):
    __tablename__ = "live_schedule_waves"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("live_flying_groups.id"), nullable=True)
    name = Column(String(50), nullable=False)
    wave_type = Column(String(20), nullable=False, default="departure")
    departure_window_start = Column(Time, nullable=False)
    departure_window_end = Column(Time, nullable=False)
    # Legacy column only. Lifetime waves do not use week_start anymore.
    week_start = Column(Date, nullable=True)

    group = relationship("LiveFlyingGroup", back_populates="waves")
    flights = relationship("LiveFlightSchedule", back_populates="wave")


class LiveFlightSchedule(Base):
    __tablename__ = "live_flight_schedule"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("live_flying_groups.id"), nullable=False)
    aircraft_id = Column(Integer, ForeignKey("live_aircraft.id"), nullable=False)
    route_id = Column(Integer, ForeignKey("routes.id"))
    departure = Column(String(4), nullable=False)
    arrival = Column(String(4), nullable=False)
    flight_number = Column(String(10))
    scheduled_departure = Column(DateTime, nullable=False)
    scheduled_arrival = Column(DateTime, nullable=False)
    wave_id = Column(Integer, ForeignKey("live_schedule_waves.id"))
    ground_time_minutes = Column(Integer, default=60)
    status = Column(
        Enum("draft", "proposed", "approved", "cancelled", name="schedule_status"),
        nullable=False,
        default="draft",
    )
    created_by = Column(Integer, ForeignKey("pilots.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("pilots.id"))
    week_start = Column(Date, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    if_schedule_id = Column(String(36), nullable=True)
    actual_departure = Column(DateTime, nullable=True)
    actual_arrival = Column(DateTime, nullable=True)
    if_session_id = Column(String(36), nullable=True)
    proposal_cost_qar = Column(Integer, nullable=False, default=0)

    group = relationship("LiveFlyingGroup", back_populates="flight_schedules")
    aircraft = relationship("LiveAircraft", back_populates="flight_schedules")
    wave = relationship("LiveScheduleWave", back_populates="flights")
    route = relationship("Route", foreign_keys=[route_id])
    creator = relationship("Pilot", foreign_keys=[created_by])
    approver = relationship("Pilot", foreign_keys=[approved_by])

    bookings = relationship("LiveFlightBooking", back_populates="schedule")


class LiveFlightBooking(Base):
    __tablename__ = "live_flight_bookings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(Integer, ForeignKey("live_flight_schedule.id"), nullable=False)
    departure_pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=True)
    arrival_pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=True)
    departure_pirep_id = Column(Integer, ForeignKey("pireps.id"), nullable=True)
    arrival_pirep_id = Column(Integer, ForeignKey("pireps.id"), nullable=True)
    booked_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    dispatched_at = Column(DateTime, nullable=True)
    pax_count = Column(Integer, nullable=True)
    landing_fpm = Column(Integer, nullable=True)
    reputation_score = Column(Float, nullable=True)
    earnings = Column(Float, nullable=True)
    expenses = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default="booked")
    released_at = Column(DateTime, nullable=True)
    released_by = Column(Integer, ForeignKey("pilots.id"), nullable=True)
    if_flight_id = Column(String(36), nullable=True)

    schedule = relationship("LiveFlightSchedule", back_populates="bookings")
    departure_pilot = relationship("Pilot", foreign_keys=[departure_pilot_id])
    arrival_pilot = relationship("Pilot", foreign_keys=[arrival_pilot_id])
    departure_pirep = relationship("Pirep", foreign_keys=[departure_pirep_id])
    arrival_pirep = relationship("Pirep", foreign_keys=[arrival_pirep_id])
    released_by_pilot = relationship("Pilot", foreign_keys=[released_by])


class LiveSetting(Base):
    __tablename__ = "live_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    setting_key = Column(String(50), nullable=False, unique=True)
    setting_value = Column(String(255), nullable=False)
    description = Column(Text)


class LiveTransfer(Base):
    __tablename__ = "live_transfers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=False)
    transfer_type = Column(
        Enum("group_switch", "career_path_switch", "path_switch", "aircraft_switch", name="transfer_type"),
        nullable=False,
    )
    from_value = Column(String(100))
    to_value = Column(String(100), nullable=False)
    reason = Column(Text)
    fee_paid_qar = Column(Integer, default=0)
    status = Column(
        Enum("pending", "approved", "denied", name="transfer_status"),
        nullable=False,
        default="pending",
    )
    requested_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    reviewed_by = Column(Integer, ForeignKey("pilots.id"))
    reviewed_at = Column(DateTime)

    pilot = relationship("Pilot", foreign_keys=[pilot_id])
    reviewer = relationship("Pilot", foreign_keys=[reviewed_by])


class AwardGranted(Base):
    __tablename__ = "awards_granted"

    id = Column(Integer, primary_key=True, autoincrement=True)
    awardid = Column(Integer, nullable=False)
    pilotid = Column(Integer, nullable=False)
    dateawarded = Column(Date)


class LiveIFOAuthToken(Base):
    __tablename__ = "live_if_oauth_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=False, unique=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    scope = Column(String(500), nullable=True)
    if_user_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    pilot = relationship("Pilot", foreign_keys=[pilot_id])


class LiveBiddingSession(Base):
    __tablename__ = "live_bidding_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("live_flying_groups.id"), nullable=False)
    slots_offered = Column(Integer, nullable=False, default=1)
    bidding_fee_qar = Column(Integer, nullable=False, default=3000)
    path_switch_fee_qar = Column(Integer, nullable=False, default=40000)
    status = Column(
        Enum("open", "under_review", "closed", "cancelled", name="bidding_session_status"),
        nullable=False,
        default="open",
    )
    opens_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    closes_at = Column(DateTime, nullable=False)
    created_by = Column(Integer, ForeignKey("pilots.id"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = relationship("LiveFlyingGroup", foreign_keys=[group_id])
    creator = relationship("Pilot", foreign_keys=[created_by])
    applicants = relationship("LiveBiddingApplicant", back_populates="session", cascade="all, delete-orphan")


class LiveBiddingApplicant(Base):
    __tablename__ = "live_bidding_applicants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("live_bidding_sessions.id"), nullable=False)
    pilot_id = Column(Integer, ForeignKey("pilots.id"), nullable=False)
    path_switch_required = Column(Boolean, nullable=False, default=False)
    bidding_fee_paid = Column(Integer, nullable=False, default=3000)
    path_switch_fee_paid = Column(Integer, nullable=False, default=0)
    status = Column(
        Enum("submitted", "awarded", "rejected", "withdrawn", name="bidding_applicant_status"),
        nullable=False,
        default="submitted",
    )
    applied_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("pilots.id"), nullable=True)
    admin_notes = Column(String(255), nullable=True)

    session = relationship("LiveBiddingSession", back_populates="applicants")
    pilot = relationship("Pilot", foreign_keys=[pilot_id])
    reviewer = relationship("Pilot", foreign_keys=[reviewed_by])

    __table_args__ = (UniqueConstraint("session_id", "pilot_id", name="uc_session_pilot"),)

