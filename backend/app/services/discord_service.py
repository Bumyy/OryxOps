import logging
import os
import httpx
from typing import Sequence
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.live_models import LiveSetting, Pilot, LiveFlightSchedule, LiveAircraft, LiveFlyingGroup

logger = logging.getLogger("discord_service")


async def get_setting_value(db: AsyncSession, key: str, fallback_env: str = "", default: str = "") -> str:
    """Helper to fetch a setting value from live_settings table or env variable fallback."""
    try:
        stmt = select(LiveSetting).where(LiveSetting.setting_key == key)
        res = await db.execute(stmt)
        setting = res.scalar_one_or_none()
        if setting and setting.setting_value and setting.setting_value.strip():
            return setting.setting_value.strip()
    except Exception as err:
        logger.warning(f"Error fetching setting {key} from DB: {err}")

    if fallback_env:
        env_val = os.getenv(fallback_env, "").strip()
        if env_val:
            return env_val

    return default


async def get_discord_webhook_url(db: AsyncSession) -> str | None:
    """Retrieves Discord fleet logs webhook URL from live_settings DB table or environment variable fallback."""
    url = await get_setting_value(db, "discord_fleet_logs_webhook_url", "DISCORD_FLEET_LOGS_WEBHOOK_URL")
    if url:
        return url
    return await get_setting_value(db, "discord_webhook_url", "DISCORD_WEBHOOK_URL")


def format_pilot_mention(pilot: Pilot | None) -> str:
    """Returns Discord mention `<@discordid>` if discordid exists, or callsign/name as fallback."""
    if not pilot:
        return "Pilot"
    if pilot.discordid and pilot.discordid.strip():
        clean_id = pilot.discordid.strip().replace("<@", "").replace(">", "")
        return f"<@{clean_id}>"
    if pilot.callsign and pilot.callsign.strip():
        return pilot.callsign.strip()
    return pilot.name or "Pilot"


def build_enroute_message(pilot: Pilot | None, ac_icao: str, ac_reg: str, destination: str) -> str:
    mention = format_pilot_mention(pilot)
    dest_clean = (destination or "OTHH").strip().upper()
    
    if dest_clean in ("OTHH", "DOHA"):
        dest_str = "heading back to base"
    else:
        dest_str = f"enroute to {dest_clean}"
        
    return f"{ac_icao} {ac_reg} {dest_str} - {mention}"


def build_parked_message(pilot: Pilot | None, ac_icao: str, ac_reg: str, actual_arrival: str) -> str:
    mention = format_pilot_mention(pilot)
    arr_clean = (actual_arrival or "OTHH").strip().upper()
    
    if arr_clean in ("OTHH", "DOHA"):
        location_str = "parked at Doha"
    else:
        location_str = f"parked at {arr_clean}"
        
    return f"{ac_icao} {ac_reg} {location_str} - {mention}"


async def send_fleet_log_webhook(db: AsyncSession, message: str) -> bool:
    webhook_url = await get_discord_webhook_url(db)
    if not webhook_url:
        logger.info("Discord fleet logs webhook URL not configured. Skipping message.")
        return False

    payload = {"content": message}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            return resp.status_code in (200, 204)
    except Exception as err:
        logger.warning(f"Error posting fleet log webhook to Discord: {err}")
        return False


async def send_staff_proposal_webhook(db: AsyncSession, pilot: Pilot, schedules: Sequence[LiveFlightSchedule]) -> bool:
    """Posts a consolidated flight proposal notification embed to Discord Staff Webhook with Staff Role Ping."""
    if not schedules:
        return False

    webhook_url = await get_setting_value(db, "discord_staff_proposals_webhook_url")
    if not webhook_url:
        # Fallback to main webhook
        webhook_url = await get_discord_webhook_url(db)
    if not webhook_url:
        logger.info("No Discord webhook configured for staff proposals.")
        return False

    staff_role_id = await get_setting_value(db, "discord_staff_role_id", default="1156454323841151007")
    role_ping = f"<@&{staff_role_id.strip()}>" if staff_role_id else ""

    pilot_mention = format_pilot_mention(pilot)
    count = len(schedules)
    pilot_name = pilot.callsign or pilot.name or "Pilot"

    fields = []
    for idx, s in enumerate(schedules[:10], 1):
        ac_str = f"{s.aircraft.registration} ({s.aircraft.aircraft_type.name if s.aircraft and s.aircraft.aircraft_type else ''})" if s.aircraft else "Unassigned Airframe"
        group_str = s.group.name if s.group else "Group"
        route_str = f"{s.departure} → {s.arrival}"
        flt_num = f" (#{s.flight_number})" if s.flight_number else ""
        fields.append({
            "name": f"{idx}. {route_str}{flt_num}",
            "value": f"✈️ **Airframe:** {ac_str}\n👥 **Group:** {group_str}\n📅 **Departure:** {str(s.scheduled_departure)[:16]} UTC",
            "inline": False,
        })

    embed = {
        "title": f"📋 {count} Flight Proposal{'s' if count != 1 else ''} Submitted",
        "description": f"**Pilot:** {pilot_name} ({pilot_mention})\n**Total Legs Submitted:** {count}",
        "color": 0x5865F2,  # Discord Blurple / Brand
        "fields": fields,
        "footer": {"text": "OryxOps Dispatch Control · Fast Approval Workflow"},
    }

    payload = {
        "username": "OryxOps Dispatch Control",
        "avatar_url": "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f4ea.png",
        "content": f"📋 **New Flight Proposal Submitted!** {role_ping}",
        "embeds": [embed],
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            return resp.status_code in (200, 204)
    except Exception as err:
        logger.warning(f"Error posting staff proposal webhook to Discord: {err}")
        return False


async def send_pilot_approval_webhook(db: AsyncSession, pilot: Pilot, schedules: Sequence[LiveFlightSchedule]) -> bool:
    """Posts a consolidated flight approval notification embed to Discord Pilot Webhook pinging the pilot."""
    if not schedules:
        return False

    webhook_url = await get_setting_value(db, "discord_pilot_approvals_webhook_url")
    if not webhook_url:
        webhook_url = await get_discord_webhook_url(db)
    if not webhook_url:
        logger.info("No Discord webhook configured for pilot approvals.")
        return False

    pilot_mention = format_pilot_mention(pilot)
    count = len(schedules)

    fields = []
    for idx, s in enumerate(schedules[:10], 1):
        ac_str = s.aircraft.registration if s.aircraft else "Airframe"
        group_str = s.group.name if s.group else "Group"
        route_str = f"{s.departure} → {s.arrival}"
        fields.append({
            "name": f"✅ {idx}. {route_str}",
            "value": f"**Airframe:** {ac_str} | **Group:** {group_str} | **Week:** {s.week_start}",
            "inline": True,
        })

    embed = {
        "title": f"🎉 {count} Flight Proposal{'s' if count != 1 else ''} Approved!",
        "description": f"Hey {pilot_mention}, your **{count} flight proposal{'s' if count != 1 else ''}** for week `{schedules[0].week_start}` have been approved by Staff! ",
        "color": 0x10B981,  # Emerald Green
        "fields": fields,
        "footer": {"text": "OryxOps Schedule Manager · Happy Flying!"},
    }

    payload = {
        "username": "OryxOps Schedule Manager",
        "avatar_url": "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/2708.png",
        "content": f"🎉 **Flight Approval Update for {pilot_mention}!**",
        "embeds": [embed],
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            return resp.status_code in (200, 204)
    except Exception as err:
        logger.warning(f"Error posting pilot approval webhook to Discord: {err}")
        return False

