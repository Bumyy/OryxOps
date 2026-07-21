import logging
import os
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.live_models import LiveSetting, Pilot

logger = logging.getLogger("discord_service")


async def get_discord_webhook_url(db: AsyncSession) -> str | None:
    """Retrieves Discord fleet logs webhook URL from live_settings DB table or environment variable fallback."""
    try:
        stmt = select(LiveSetting).where(LiveSetting.setting_key == "discord_fleet_logs_webhook_url")
        res = await db.execute(stmt)
        setting = res.scalar_one_or_none()
        if setting and setting.setting_value and setting.setting_value.strip():
            return setting.setting_value.strip()
    except Exception as err:
        logger.warning(f"Error fetching discord_fleet_logs_webhook_url setting from DB: {err}")

    # Fallback to environment variable or main webhook setting
    env_url = os.getenv("DISCORD_FLEET_LOGS_WEBHOOK_URL", "").strip()
    if env_url:
        return env_url

    try:
        stmt = select(LiveSetting).where(LiveSetting.setting_key == "discord_webhook_url")
        res = await db.execute(stmt)
        setting = res.scalar_one_or_none()
        if setting and setting.setting_value and setting.setting_value.strip():
            return setting.setting_value.strip()
    except Exception:
        pass

    return None


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
    """Builds the enroute status message for Discord #fleet-logs.
    
    Examples:
    - B77W A7-BAB enroute to VCBI
    - A388 A7-APC heading back to base
    - A359 A7-ALR enroute to Doha
    """
    mention = format_pilot_mention(pilot)
    dest_clean = (destination or "OTHH").strip().upper()
    
    if dest_clean in ("OTHH", "DOHA"):
        dest_str = "heading back to base"  # Or "enroute to Doha"
    else:
        dest_str = f"enroute to {dest_clean}"
        
    return f"{ac_icao} {ac_reg} {dest_str} - {mention}"


def build_parked_message(pilot: Pilot | None, ac_icao: str, ac_reg: str, actual_arrival: str) -> str:
    """Builds the parked status message for Discord #fleet-logs.
    
    Examples:
    - B77W A7-BAB parked at VCBI
    - A359 A7-ALR parked at Doha
    - A388 A7-APD Parked at OTHH
    """
    mention = format_pilot_mention(pilot)
    arr_clean = (actual_arrival or "OTHH").strip().upper()
    
    if arr_clean in ("OTHH", "DOHA"):
        location_str = "parked at Doha"
    else:
        location_str = f"parked at {arr_clean}"
        
    return f"{ac_icao} {ac_reg} {location_str} - {mention}"


async def send_fleet_log_webhook(db: AsyncSession, message: str) -> bool:
    """Sends a formatted message to Discord #fleet-logs webhook.
    
    Returns True if sent successfully, False otherwise.
    Fails silently with warning logs so API endpoints are never interrupted.
    """
    webhook_url = await get_discord_webhook_url(db)
    if not webhook_url:
        logger.info("Discord fleet logs webhook URL not configured. Skipping message.")
        return False

    payload = {
        "content": message
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code in (200, 204):
                logger.info(f"Fleet log posted to Discord: {message}")
                return True
            else:
                logger.warning(f"Failed to post fleet log to Discord (HTTP {resp.status_code}): {resp.text}")
                return False
    except Exception as err:
        logger.warning(f"Error posting fleet log webhook to Discord: {err}")
        return False
