import random
import httpx
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_models import (
    LiveAircraft,
    LiveFlightBooking,
    LiveFlightSchedule,
    LiveCurrency,
    LiveCurrencyTransaction,
    LiveSetting,
    Pilot,
    Pirep
)

# Predefined aircraft passenger capacities
import json
import os

AIRCRAFT_JSON_MAPPING = {
    "A380": "A388",
    "B787": "B788",
    "B789": "B788",
    "B777": "B77W",
    "B772": "B77L",
    "B77F": "B77L",
    "A330": "A333",
    "A332": "A333",
    "A340": "A359",
}

def get_aircraft_json_data(icao_code: str) -> dict:
    """Loads capacity and operating_cost for aircraft from local JSON asset."""
    icao = icao_code.strip().upper()
    mapped_icao = AIRCRAFT_JSON_MAPPING.get(icao, icao)
    
    # Load assets/aircrafts.json
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    json_path = os.path.join(base_dir, "assets", "aircrafts.json")
    
    defaults = {"capacity": 180, "operating_cost": 1800.0}
    
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if mapped_icao in data:
                    props = data[mapped_icao].get("properties", {})
                    return {
                        "capacity": props.get("capacity", defaults["capacity"]),
                        "operating_cost": float(props.get("operating_cost", defaults["operating_cost"]))
                    }
        except Exception:
            pass
            
    return defaults

async def get_rate_settings(db: AsyncSession) -> dict[str, float]:
    """Retrieves all rate and economics settings from live_settings database table."""
    result = await db.execute(
        select(LiveSetting).where(
            LiveSetting.setting_key.like("econ_%") | LiveSetting.setting_key.like("repu_%")
        )
    )
    settings = result.scalars().all()
    
    # Mapped defaults
    defaults = {
        "econ_fuel_price_rate": 1.10,
        "econ_ticket_base_price": 150.0,
        "econ_ticket_duration_rate": 2.00,
        "econ_base_maintenance_fee": 500.0,
        "econ_hard_landing_threshold": 150.0,
        "econ_hard_landing_multiplier": 12.0,
        "econ_hard_landing_exponent": 1.5,
        "repu_punctuality_grace": 30.0,
        "repu_smoothness_threshold": 100.0,
        "repu_smoothness_divisor": 4.0,
        "econ_payout_share_solo": 0.10,
        "econ_payout_share_split": 0.05,
        "econ_min_payout_solo": 750.0,
        "econ_min_payout_split": 350.0,
        "econ_fixed_rate_per_seat": 120.0,
        "econ_service_rate_per_pax": 60.0,
        "econ_diversion_charge_per_pax": 100.0,
    }
    
    for s in settings:
        try:
            defaults[s.setting_key] = float(s.setting_value)
        except (ValueError, TypeError):
            pass
            
    return defaults


async def get_airport_class_and_fee(db: AsyncSession, icao_code: str) -> tuple[str, int]:
    """
    Classifies airport size and returns landing fee.
    Checks backend/app/assets/airports.csv for OurAirports classification first.
    Falls back to manual override settings from live_settings if not found in the CSV,
    then defaults to Small.
    """
    icao = icao_code.strip().upper()

    # Load landing fees from database settings with fallbacks
    fee_large = 7000
    fee_medium = 3500
    fee_small = 1200
    
    try:
        stmt = select(LiveSetting).where(LiveSetting.setting_key.in_([
            "econ_airport_fee_large", "econ_airport_fee_medium", "econ_airport_fee_small"
        ]))
        res = await db.execute(stmt)
        settings = res.scalars().all()
        for s in settings:
            if s.setting_key == "econ_airport_fee_large":
                fee_large = int(float(s.setting_value))
            elif s.setting_key == "econ_airport_fee_medium":
                fee_medium = int(float(s.setting_value))
            elif s.setting_key == "econ_airport_fee_small":
                fee_small = int(float(s.setting_value))
    except Exception:
        pass

    # 1. Check local assets/airports.csv
    import os
    import csv
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(base_dir, "assets", "airports.csv")
    if os.path.exists(csv_path):
        try:
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("ident", "").strip().upper() == icao:
                        apt_type = row.get("type", "").strip().lower()
                        if apt_type == "large_airport":
                            return "Large", fee_large
                        elif apt_type == "medium_airport":
                            return "Medium", fee_medium
                        elif apt_type == "small_airport":
                            return "Small", fee_small
                        break
        except Exception:
            pass

    # 2. Check override settings from live_settings (fallback)
    try:
        stmt = select(LiveSetting).where(LiveSetting.setting_key.in_([
            "override_large_airports", "override_medium_airports", "override_small_airports"
        ]))
        res = await db.execute(stmt)
        settings = res.scalars().all()
        overrides = {s.setting_key: s.setting_value for s in settings}

        large_list = [x.strip().upper() for x in overrides.get("override_large_airports", "").split(",") if x.strip()]
        medium_list = [x.strip().upper() for x in overrides.get("override_medium_airports", "").split(",") if x.strip()]
        small_list = [x.strip().upper() for x in overrides.get("override_small_airports", "").split(",") if x.strip()]

        if icao in large_list:
            return "Large", fee_large
        if icao in medium_list:
            return "Medium", fee_medium
        if icao in small_list:
            return "Small", fee_small
    except Exception:
        pass

    # Default: treat as Small
    return "Small", fee_small

async def get_bookings(
    db: AsyncSession,
    pilot_id: int | None = None,
    schedule_id: int | None = None,
    status: str | None = None,
    group_id: int | None = None,
) -> list[LiveFlightBooking]:
    query = select(LiveFlightBooking).options(
        selectinload(LiveFlightBooking.schedule)
        .selectinload(LiveFlightSchedule.aircraft)
        .selectinload(LiveAircraft.aircraft_type),
        selectinload(LiveFlightBooking.departure_pilot),
        selectinload(LiveFlightBooking.arrival_pilot),
        selectinload(LiveFlightBooking.departure_pirep),
        selectinload(LiveFlightBooking.arrival_pirep),
    )

    if pilot_id:
        query = query.where(
            (LiveFlightBooking.departure_pilot_id == pilot_id) |
            (LiveFlightBooking.arrival_pilot_id == pilot_id)
        )
    if schedule_id:
        query = query.where(LiveFlightBooking.schedule_id == schedule_id)
    if status:
        if status == "logs":
            # For logs, show completed, rejected, or cancelled
            query = query.where(LiveFlightBooking.status.in_(["completed", "rejected", "cancelled"]))
        else:
            query = query.where(LiveFlightBooking.status == status)
    if group_id:
        query = query.join(LiveFlightSchedule).where(
            LiveFlightSchedule.group_id == group_id
        )

    query = query.order_by(LiveFlightBooking.booked_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_booking(db: AsyncSession, booking_id: int) -> LiveFlightBooking | None:
    result = await db.execute(
        select(LiveFlightBooking)
        .where(LiveFlightBooking.id == booking_id)
        .options(
            selectinload(LiveFlightBooking.schedule)
            .selectinload(LiveFlightSchedule.aircraft)
            .selectinload(LiveAircraft.aircraft_type),
            selectinload(LiveFlightBooking.departure_pilot),
            selectinload(LiveFlightBooking.arrival_pilot),
            selectinload(LiveFlightBooking.departure_pirep),
            selectinload(LiveFlightBooking.arrival_pirep),
        )
    )
    return result.scalar_one_or_none()


async def create_booking(
    db: AsyncSession, schedule_id: int, pilot_id: int, booking_type: str = "both", commit: bool = True
) -> list[LiveFlightBooking] | None:
    schedule_result = await db.execute(
        select(LiveFlightSchedule).where(LiveFlightSchedule.id == schedule_id)
    )
    schedule = schedule_result.scalar_one_or_none()
    if not schedule or schedule.status != "approved":
        return None

    # Retrieve existing booking row for this schedule
    existing_result = await db.execute(
        select(LiveFlightBooking).where(
            LiveFlightBooking.schedule_id == schedule_id,
            LiveFlightBooking.status.in_(["booked"])
        )
    )
    booking = existing_result.scalar_one_or_none()

    if booking_type == "departure":
        if booking:
            if booking.departure_pilot_id is not None:
                return None  # Departure already booked
            booking.departure_pilot_id = pilot_id
        else:
            booking = LiveFlightBooking(
                schedule_id=schedule_id,
                departure_pilot_id=pilot_id,
                arrival_pilot_id=None,
                status="booked"
            )
            db.add(booking)
    elif booking_type == "arrival":
        if booking:
            if booking.arrival_pilot_id is not None:
                return None  # Arrival already booked
            booking.arrival_pilot_id = pilot_id
        else:
            booking = LiveFlightBooking(
                schedule_id=schedule_id,
                departure_pilot_id=None,
                arrival_pilot_id=pilot_id,
                status="booked"
            )
            db.add(booking)
    elif booking_type == "both":
        if booking:
            return None  # Schedule is already booked in some form
        booking = LiveFlightBooking(
            schedule_id=schedule_id,
            departure_pilot_id=pilot_id,
            arrival_pilot_id=pilot_id,
            status="booked"
        )
        db.add(booking)
    else:
        return None

    if commit:
        await db.commit()
        await db.refresh(booking)
    else:
        await db.flush()
        await db.refresh(booking)

    # Return as a list for schema/endpoint compatibility
    return [booking]


async def dispatch_booking(db: AsyncSession, booking_id: int, pilot_id: int) -> LiveFlightBooking | None:
    booking = await get_booking(db, booking_id)
    if not booking or booking.status != "booked":
        return None
        
    # Check authorization
    if booking.departure_pilot_id != pilot_id and booking.arrival_pilot_id != pilot_id:
        return None
        
    # If already dispatched, just return
    if booking.dispatched_at is not None:
        return booking

    # Check if a departure pilot exists and is not the current one (meaning arrival pilot is dispatching)
    # If departure pilot exists, they are the ones who must click dispatch first.
    # But if arrival pilot dispatches, they inherit pax_count.
    if booking.departure_pilot_id and booking.departure_pilot_id != pilot_id:
        # Departure pilot exists and hasn't dispatched yet
        if booking.pax_count is None:
            return None # Cannot dispatch arrival before departure generates passengers

    # 1. Determine aircraft capacity
    icao = "A320"
    if booking.schedule and booking.schedule.aircraft and booking.schedule.aircraft.aircraft_type:
        icao = (booking.schedule.aircraft.aircraft_type.icao or "A320").upper()
    
    # Load capacity dynamically from JSON
    aircraft_data = get_aircraft_json_data(icao)
    capacity = aircraft_data["capacity"]

    # 2. Check if outbound (origin is OTHH) or inbound
    dep_apt = (booking.schedule.departure or "OTHH").upper() if booking.schedule else "OTHH"
    
    # 3. Calculate Passenger load
    variance = random.uniform(0.95, 1.05)
    
    if dep_apt == "OTHH":
        # Outbound: Passenger load based on global average reputation
        rep_stmt = select(func.avg(LiveCurrencyTransaction.amount)).where(
            LiveCurrencyTransaction.transaction_type == "lift_boost"
        )
        avg_rep_val = (await db.execute(rep_stmt)).scalar()
        avg_rep = float(avg_rep_val) if avg_rep_val is not None else 80.0
            
        pax = int(capacity * (avg_rep / 100.0) * variance)
    else:
        # Inbound: Passenger load based on last completed flight on this aircraft airframe + Return Flight reduced pax (70-90%)
        aircraft_id = booking.schedule.aircraft_id if booking.schedule else None
        last_rep = 80.0
        if aircraft_id:
            # Query last completed booking for this aircraft
            last_booking_stmt = (
                select(LiveFlightBooking)
                .join(LiveFlightSchedule)
                .where(
                    LiveFlightSchedule.aircraft_id == aircraft_id,
                    LiveFlightBooking.status == "completed"
                )
                .order_by(LiveFlightBooking.booked_at.desc())
                .limit(1)
            )
            last_booking = (await db.execute(last_booking_stmt)).scalar_one_or_none()
            if last_booking and last_booking.reputation_score is not None:
                last_rep = float(last_booking.reputation_score)
                
        pax = int(capacity * (last_rep / 100.0) * variance * random.uniform(0.70, 0.90))

    pax = max(10, min(capacity, pax))  # Clamp between 10 and max capacity
    
    booking.dispatched_at = datetime.utcnow()
    booking.pax_count = pax
    
    await db.commit()
    await db.refresh(booking)
    return booking


async def cancel_booking(db: AsyncSession, booking_id: int, pilot_id: int) -> LiveFlightBooking | None:
    booking = await get_booking(db, booking_id)
    if not booking or booking.status != "booked":
        return None
        
    # Check if they are the departure and/or arrival pilot
    is_dep = booking.departure_pilot_id == pilot_id
    is_arr = booking.arrival_pilot_id == pilot_id
    
    if not is_dep and not is_arr:
        return None

    if is_dep:
        booking.departure_pilot_id = None
    if is_arr:
        booking.arrival_pilot_id = None
        
    # If both are cancelled, mark row as cancelled
    if booking.departure_pilot_id is None and booking.arrival_pilot_id is None:
        booking.status = "cancelled"
        
    await db.commit()
    await db.refresh(booking)
    return booking


async def complete_booking(
    db: AsyncSession,
    booking_id: int,
    flight_time_minutes: int,
    fuel_burned: float,
    landing_fpm: int,
    actual_arrival: str | None = None
) -> LiveFlightBooking | None:
    """
    Files a manual EFB PIREP.
    Inserts a row into the legacy 'pireps' table with flightnum='CM' and accepted=0 (Pending Review).
    Calculates estimated economics on the booking, but does NOT payout the salary yet.
    """
    booking = await get_booking(db, booking_id)
    if not booking or booking.status != "booked":
        return None

    is_departure_only = booking.departure_pilot_id is not None and booking.arrival_pilot_id is None
    pilot_id = booking.departure_pilot_id if is_departure_only else booking.arrival_pilot_id

    # Detect diversion
    scheduled_arrival = (booking.schedule.arrival or "OTHH").upper() if booking.schedule else "OTHH"
    arrival_airport = scheduled_arrival
    if actual_arrival and len(actual_arrival.strip()) == 4:
        arrival_airport = actual_arrival.strip().upper()

    # Create new legacy PIREP
    new_pirep = Pirep(
        pilotid=pilot_id,
        departure=(booking.schedule.departure or "OTHH").upper() if booking.schedule else "OTHH",
        arrival=arrival_airport,
        aircraftid=booking.schedule.aircraft_id if booking.schedule else None,
        flighttime=int(flight_time_minutes * 60),  # seconds as integer
        date=datetime.utcnow().date(),
        status=0,  # Pending review
        fuelused=int(fuel_burned),
        flightnum="CM",
        multi=""
    )
    db.add(new_pirep)
    await db.flush()  # Populate ID

    if is_departure_only:
        booking.departure_pirep_id = new_pirep.id
    else:
        booking.arrival_pirep_id = new_pirep.id
        booking.landing_fpm = landing_fpm

    # Load dynamic rate/repu settings from database
    rates = await get_rate_settings(db)

    # 1. Earnings (Pax ticket sales)
    pax = booking.pax_count or 100
    ticket_price = rates["econ_ticket_base_price"] + (flight_time_minutes * rates["econ_ticket_duration_rate"])
    total_earnings = pax * ticket_price

    # 2. Expenses (Fuel + Airport fee + Landing penalty + Operating Cost + Diversion Charge)
    fuel_expense = fuel_burned * rates["econ_fuel_price_rate"]
    
    # Landing fee for the actual airport landed at
    _, landing_fee = await get_airport_class_and_fee(db, arrival_airport)
    
    # Load aircraft capacity from JSON
    icao_model = "A320"
    if booking.schedule and booking.schedule.aircraft and booking.schedule.aircraft.aircraft_type:
        icao_model = (booking.schedule.aircraft.aircraft_type.icao or "A320").upper()
    ac_data = get_aircraft_json_data(icao_model)
    capacity = ac_data.get("capacity", 180)
    
    # Calculate operating cost using capacity and pax
    operating_cost = (capacity * rates["econ_fixed_rate_per_seat"]) + (pax * rates["econ_service_rate_per_pax"])

    # Passenger-scaled Diversion Charge if applicable
    is_diverted = arrival_airport != scheduled_arrival
    diversion_charge = (pax * rates["econ_diversion_charge_per_pax"]) if is_diverted else 0.0

    # Discrete landing penalty table
    fpm = landing_fpm
    if fpm <= 100:
        landing_penalty = 0.0
    elif fpm <= 200:
        landing_penalty = 500.0
    elif fpm <= 300:
        landing_penalty = 2000.0
    elif fpm <= 400:
        landing_penalty = 6000.0
    else:
        landing_penalty = 15000.0
        
    total_expenses = fuel_expense + landing_fee + landing_penalty + operating_cost + diversion_charge
    
    # 3. Reputation
    expected_dur = 45 # Default
    if booking.schedule:
        sched_time = (booking.schedule.scheduled_arrival - booking.schedule.scheduled_departure).total_seconds() / 60.0
        expected_dur = int(sched_time) if sched_time > 0 else 120
        
    actual_dur = flight_time_minutes
    diff = abs(actual_dur - expected_dur)
    punctuality_score = 100.0
    if diff > rates["repu_punctuality_grace"]:
        punctuality_score = max(0.0, 100.0 - (diff - rates["repu_punctuality_grace"]))
        
    # Landing FPM rating
    landing_score = 100.0
    if fpm > rates["repu_smoothness_threshold"]:
        landing_score = max(0.0, 100.0 - (fpm - rates["repu_smoothness_threshold"]) / rates["repu_smoothness_divisor"])
        
    if is_departure_only:
        overall_rep = punctuality_score
    else:
        overall_rep = (punctuality_score + landing_score) / 2.0
        
    booking.earnings = total_earnings
    booking.expenses = total_expenses
    booking.reputation_score = round(overall_rep / 20.0, 2)
    booking.status = "completed"

    # Extract webhook variables BEFORE committing (which would expire relationships and cause MissingGreenlet)
    dep_icao = (booking.schedule.departure or "OTHH").upper() if booking.schedule else "OTHH"
    arr_icao = (booking.schedule.arrival or "EGLL").upper() if booking.schedule else "EGLL"
    flt_num = booking.schedule.flight_number if booking.schedule else "N/A"
    ac_reg = booking.schedule.aircraft.registration if booking.schedule and booking.schedule.aircraft else "N/A"
    ac_icao = booking.schedule.aircraft.aircraft_type.icao if booking.schedule and booking.schedule.aircraft and booking.schedule.aircraft.aircraft_type else "N/A"
    
    dep_callsign = booking.departure_pilot.callsign if booking.departure_pilot else None
    arr_callsign = booking.arrival_pilot.callsign if booking.arrival_pilot else None
    dep_pilot_id = booking.departure_pilot_id
    arr_pilot_id = booking.arrival_pilot_id

    await db.commit()
    await db.refresh(booking)

    # Post to Discord Webhook
    await post_completion_webhook(
        db=db,
        dep_icao=dep_icao,
        arr_icao=arr_icao,
        flt_num=flt_num,
        ac_reg=ac_reg,
        ac_icao=ac_icao,
        dep_callsign=dep_callsign,
        arr_callsign=arr_callsign,
        dep_pilot_id=dep_pilot_id,
        arr_pilot_id=arr_pilot_id,
        minutes=flight_time_minutes,
        fuel=fuel_burned,
        fpm=landing_fpm,
        earnings=total_earnings,
        expenses=total_expenses
    )

    return booking


async def post_completion_webhook(
    db: AsyncSession,
    dep_icao: str,
    arr_icao: str,
    flt_num: str,
    ac_reg: str,
    ac_icao: str,
    dep_callsign: str | None,
    arr_callsign: str | None,
    dep_pilot_id: int | None,
    arr_pilot_id: int | None,
    minutes: int,
    fuel: float,
    fpm: int,
    earnings: float,
    expenses: float
):
    """Posts a premium completed flight notification embed to Discord Webhook."""
    stmt = select(LiveSetting).where(LiveSetting.setting_key == "discord_webhook_url")
    webhook_setting = (await db.execute(stmt)).scalar_one_or_none()
    if not webhook_setting or not webhook_setting.setting_value:
        return
        
    webhook_url = webhook_setting.setting_value.strip()
    
    # Emojis for FPM
    fpm_emoji = "🟢"
    if fpm > 250:
        fpm_emoji = "🔴"
    elif fpm > 150:
        fpm_emoji = "🟡"
        
    # Pilots
    is_solo = dep_pilot_id == arr_pilot_id
    if is_solo:
        pilot_text = f"👤 **Solo Pilot:** {dep_callsign or 'Unknown'}"
    else:
        pilot_text = (
            f"🛫 **Takeoff Pilot:** {dep_callsign or 'Vacant'}\n"
            f"🛬 **Landing Pilot:** {arr_callsign or 'Vacant'}"
        )
        
    payload = {
        "embeds": [
            {
                "title": "✈️ New Flight PIREP Filed (CM Mode)",
                "color": 9843250, # Crimson burgundy (0x963232)
                "description": f"A flight leg has been completed and submitted for review.\n\n{pilot_text}",
                "fields": [
                    {"name": "Flight & Route", "value": f"**{flt_num}** ({dep_icao} ➔ {arr_icao})", "inline": True},
                    {"name": "Aircraft", "value": f"**{ac_reg}** ({ac_icao})", "inline": True},
                    {"name": "Landing Rate", "value": f"{fpm_emoji} **{fpm} FPM**", "inline": True},
                    {"name": "Duration", "value": f"⏱️ **{minutes} min**", "inline": True},
                    {"name": "Estimated Revenue", "value": f"💵 **+{int(earnings):,} QAR**", "inline": True},
                    {"name": "Estimated Expenses", "value": f"⛽ **-{int(expenses):,} QAR**", "inline": True}
                ],
                "footer": {"text": "Qatari Virtual EFB · Awaiting Staff Approval"},
                "timestamp": datetime.utcnow().isoformat()
            }
        ]
    }
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(webhook_url, json=payload, timeout=5.0)
    except Exception as e:
        print(f"Error posting discord webhook: {e}")


async def lazy_check_payouts(db: AsyncSession, pilot_id: int):
    """
    Checks all completed bookings for a pilot and applies payouts if the PIREPs are accepted (accepted=1)
    or marks rejected if accepted=2.
    """
    # Load dynamic rate/repu settings from database
    rates = await get_rate_settings(db)

    stmt = (
        select(LiveFlightBooking)
        .where(
            LiveFlightBooking.status == "completed",
            (LiveFlightBooking.departure_pilot_id == pilot_id) | (LiveFlightBooking.arrival_pilot_id == pilot_id)
        )
        .options(
            selectinload(LiveFlightBooking.schedule)
            .selectinload(LiveFlightSchedule.aircraft)
            .selectinload(LiveAircraft.aircraft_type),
            selectinload(LiveFlightBooking.departure_pilot),
            selectinload(LiveFlightBooking.arrival_pilot)
        )
    )
    bookings_res = await db.execute(stmt)
    completed_bookings = bookings_res.scalars().all()
    
    for booking in completed_bookings:
        # Check if salary was already paid (meaning LiveCurrencyTransaction exists for this reference_id)
        payout_stmt = select(LiveCurrencyTransaction).where(
            LiveCurrencyTransaction.reference_id == booking.id,
            LiveCurrencyTransaction.transaction_type == "flight_completed"
        )
        payout_exists = (await db.execute(payout_stmt)).scalar_one_or_none()
        if payout_exists:
            continue # Already paid
            
        # Get the linked PIREP id
        is_dep_only = booking.departure_pilot_id is not None and booking.arrival_pilot_id is None
        pirep_id = booking.departure_pirep_id if is_dep_only else booking.arrival_pirep_id
        if not pirep_id:
            continue
            
        # Query PIREP status
        pirep_stmt = select(Pirep).where(Pirep.id == pirep_id)
        pirep = (await db.execute(pirep_stmt)).scalar_one_or_none()
        if not pirep:
            continue
            
        if pirep.status == 1:
            # 1. APPROVED! Process final payout
            # Get approved values (in case staff edited them)
            # Duration in seconds in db. Convert to minutes.
            seconds = float(pirep.flighttime or 0)
            approved_dur = int(seconds / 60) if seconds > 300 else int(seconds)
            if approved_dur <= 0:
                approved_dur = 60
                
            approved_fuel = float(pirep.fuelused or 0)
            
            # Recalculate final financials
            pax = booking.pax_count or 100
            ticket_price = rates["econ_ticket_base_price"] + (approved_dur * rates["econ_ticket_duration_rate"])
            final_earnings = pax * ticket_price
            
            fuel_expense = approved_fuel * rates["econ_fuel_price_rate"]
            
            # Destination fee is based on the actual PIREP arrival airport (diversion airport if diverted)
            arrival_airport = (pirep.arrival or (booking.schedule.arrival if booking.schedule else "OTHH")).upper()
            _, landing_fee = await get_airport_class_and_fee(db, arrival_airport)
            
            # Aircraft capacity
            icao_model = "A320"
            if booking.schedule and booking.schedule.aircraft and booking.schedule.aircraft.aircraft_type:
                icao_model = (booking.schedule.aircraft.aircraft_type.icao or "A320").upper()
            ac_data = get_aircraft_json_data(icao_model)
            capacity = ac_data.get("capacity", 180)
            operating_cost = (capacity * rates["econ_fixed_rate_per_seat"]) + (pax * rates["econ_service_rate_per_pax"])
            
            # Diversion charge
            scheduled_arrival = (booking.schedule.arrival or "OTHH").upper() if booking.schedule else "OTHH"
            is_diverted = arrival_airport != scheduled_arrival
            diversion_charge = (pax * rates["econ_diversion_charge_per_pax"]) if is_diverted else 0.0
            
            # Discrete landing penalty table
            fpm = int(booking.landing_fpm or 120)
            if fpm <= 100:
                landing_penalty = 0.0
            elif fpm <= 200:
                landing_penalty = 500.0
            elif fpm <= 300:
                landing_penalty = 2000.0
            elif fpm <= 400:
                landing_penalty = 6000.0
            else:
                landing_penalty = 15000.0
                
            final_expenses = fuel_expense + landing_fee + landing_penalty + operating_cost + diversion_charge
            final_profit = final_earnings - final_expenses
            
            # Save final approved details
            booking.earnings = final_earnings
            booking.expenses = final_expenses
            
            # Calculate salary and write ledger rows
            is_split = booking.departure_pilot_id is not None and booking.arrival_pilot_id is not None and booking.departure_pilot_id != booking.arrival_pilot_id
            
            if is_split:
                # Departure Salary share
                dep_salary = int(final_profit * rates["econ_payout_share_split"]) if final_profit > 0 else int(rates["econ_min_payout_split"])
                if dep_salary < int(rates["econ_min_payout_split"]):
                    dep_salary = int(rates["econ_min_payout_split"])
                # Arrival Salary share
                arr_salary = int(final_profit * rates["econ_payout_share_split"]) if final_profit > 0 else int(rates["econ_min_payout_split"])
                if arr_salary < int(rates["econ_min_payout_split"]):
                    arr_salary = int(rates["econ_min_payout_split"])
                    
                # Write ledger for departure
                await record_ledger_rows(
                    db=db,
                    pilot_id=booking.departure_pilot_id,
                    booking_id=booking.id,
                    revenue=int(final_earnings * 0.5),
                    expenses=int(final_expenses * 0.5),
                    salary=dep_salary,
                    reputation=int((booking.reputation_score or 4.0) * 20.0),
                    desc_suffix="(Approved - 50% split - departure)"
                )
                
                # Write ledger for arrival
                await record_ledger_rows(
                    db=db,
                    pilot_id=booking.arrival_pilot_id,
                    booking_id=booking.id,
                    revenue=int(final_earnings * 0.5),
                    expenses=int(final_expenses * 0.5),
                    salary=arr_salary,
                    reputation=int((booking.reputation_score or 4.0) * 20.0),
                    desc_suffix="(Approved - 50% split - arrival)"
                )
                
                airline_profit = final_profit - dep_salary - arr_salary
            else:
                solo_pilot_id = booking.arrival_pilot_id if booking.arrival_pilot_id else booking.departure_pilot_id
                solo_salary = int(final_profit * rates["econ_payout_share_solo"]) if final_profit > 0 else int(rates["econ_min_payout_solo"])
                if solo_salary < int(rates["econ_min_payout_solo"]):
                    solo_salary = int(rates["econ_min_payout_solo"])
                    
                await record_ledger_rows(
                    db=db,
                    pilot_id=solo_pilot_id,
                    booking_id=booking.id,
                    revenue=int(final_earnings),
                    expenses=int(final_expenses),
                    salary=solo_salary,
                    reputation=int((booking.reputation_score or 4.0) * 20.0),
                    desc_suffix="(Approved - 100% solo)"
                )
                
                airline_profit = final_profit - solo_salary
                
            # Update global treasury
            balance_setting_stmt = select(LiveSetting).where(LiveSetting.setting_key == "airline_balance")
            setting = (await db.execute(balance_setting_stmt)).scalar_one_or_none()
            if setting:
                current_bal = float(setting.setting_value or 5000000)
                setting.setting_value = str(int(current_bal + airline_profit))
                
            await db.commit()
            
        elif pirep.status == 2:
            # 2. REJECTED! Update booking status to rejected
            booking.status = "rejected"
            await db.commit()


async def record_ledger_rows(
    db: AsyncSession,
    pilot_id: int,
    booking_id: int,
    revenue: int,
    expenses: int,
    salary: int,
    reputation: int,
    desc_suffix: str
):
    """Inserts ledger rows into live_currency_transactions and updates pilot wallet."""
    # 1. Gross Revenue -> admin_grant
    db.add(LiveCurrencyTransaction(
        pilot_id=pilot_id,
        amount=int(revenue),
        transaction_type="admin_grant",
        reference_id=booking_id,
        description=f"Flight revenue {desc_suffix}"
    ))

    # 2. Gross Expenses -> admin_remove
    db.add(LiveCurrencyTransaction(
        pilot_id=pilot_id,
        amount=int(-expenses),
        transaction_type="admin_remove",
        reference_id=booking_id,
        description=f"Operational expenses {desc_suffix}"
    ))

    # 3. Pilot Salary -> flight_completed
    db.add(LiveCurrencyTransaction(
        pilot_id=pilot_id,
        amount=int(salary),
        transaction_type="flight_completed",
        reference_id=booking_id,
        description=f"Flight salary payout {desc_suffix}"
    ))

    # 4. Flight Reputation -> lift_boost
    db.add(LiveCurrencyTransaction(
        pilot_id=pilot_id,
        amount=int(reputation),
        transaction_type="lift_boost",
        reference_id=booking_id,
        description=f"Flight reputation score {desc_suffix}"
    ))

    # 5. Credit Pilot Wallet
    wallet_stmt = select(LiveCurrency).where(LiveCurrency.pilot_id == pilot_id)
    wallet = (await db.execute(wallet_stmt)).scalar_one_or_none()
    if not wallet:
        wallet = LiveCurrency(pilot_id=pilot_id, balance=0, total_earned=0, total_spent=0)
        db.add(wallet)
        
    wallet.balance += int(salary)
    wallet.total_earned += int(salary)


async def mark_no_show(db: AsyncSession, booking_id: int) -> LiveFlightBooking | None:
    booking = await get_booking(db, booking_id)
    if not booking or booking.status != "booked":
        return None
    booking.status = "no_show"
    await db.commit()
    await db.refresh(booking)
    return booking


async def take_over_booking(
    db: AsyncSession, booking_id: int, new_pilot_id: int
) -> LiveFlightBooking | None:
    booking = await get_booking(db, booking_id)
    if not booking or booking.status not in ["no_show", "cancelled"]:
        return None
        
    # Redesign reassign: new pilot takes over the vacant part
    if booking.departure_pilot_id is None:
        booking.departure_pilot_id = new_pilot_id
    elif booking.arrival_pilot_id is None:
        booking.arrival_pilot_id = new_pilot_id
    else:
        return None
        
    booking.status = "booked"
    await db.commit()
    await db.refresh(booking)
    return booking
