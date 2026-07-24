from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
import httpx
import logging

from app.core.config import settings

router = APIRouter(prefix="/charts", tags=["Charts"])
logger = logging.getLogger(__name__)


@router.get("/embed-config/{airport_ident}")
async def get_embed_config(airport_ident: str, dark_mode: bool = Query(True)):
    """
    Returns the direct ChartFox interface URL for iframe embedding.
    This ensures same-origin asset loading for ChartFox's JavaScript modules.
    """
    token = settings.chartfox_api_token
    if not token:
        raise HTTPException(
            status_code=500,
            detail="ChartFox API token is not configured on the backend server."
        )

    clean_ident = airport_ident.strip().upper()
    url = f"https://api.chartfox.org/v2/interfaces/airport/{clean_ident}?token={token}&darkMode={'true' if dark_mode else 'false'}"
    return {"url": url}
