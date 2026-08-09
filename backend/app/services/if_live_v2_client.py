import httpx
import math
from datetime import datetime, timezone
from typing import Any, Optional, Dict, List
from app.core.config import settings

BASE_URL = "https://api.infiniteflight.com/public/v2"

class IFLiveV2Client:
    """Client for the Infinite Flight Live V2 API.
    
    If settings.if_api_key is empty or invalid, falls back to a simulated
    mock mode to facilitate frontend testing.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.if_api_key
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        } if self.api_key else {}
        
    @property
    def is_mock(self) -> bool:
        from app.services.if_v2_client import IFV2Client
        return IFV2Client._force_mock or not bool(self.api_key)

    async def get_sessions(self) -> List[Dict[str, Any]]:
        if self.is_mock:
            return [{
                "id": "mock-session-id",
                "name": "Mock Server (Casual)",
                "maxUsers": 1000,
                "userCount": 250,
                "type": 0,
                "worldType": 1,
                "minimumGradeLevel": 1,
                "minimumAppVersion": "24.3",
                "maximumAppVersion": None
            }]
            
        async with httpx.AsyncClient() as client:
            url = f"{BASE_URL}/sessions"
            params = {"apikey": self.api_key} if self.api_key else {}
            response = await client.get(url, params=params, headers=self.headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data.get("errorCode") == 0:
                    return data.get("result", [])
            return []

    async def get_flights(self, session_id: str) -> List[Dict[str, Any]]:
        if self.is_mock:
            # We don't have access to the db here, so we will generate dynamically or handle matching in mock
            return []
            
        async with httpx.AsyncClient() as client:
            url = f"{BASE_URL}/sessions/{session_id}/flights"
            params = {"apikey": self.api_key} if self.api_key else {}
            response = await client.get(url, params=params, headers=self.headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data.get("errorCode") == 0:
                    return data.get("result", [])
            return []

    async def get_flight_plan(self, session_id: str, flight_id: str) -> Optional[Dict[str, Any]]:
        if self.is_mock:
            return None
            
        async with httpx.AsyncClient() as client:
            url = f"{BASE_URL}/sessions/{session_id}/flights/{flight_id}/flightplan"
            params = {"apikey": self.api_key} if self.api_key else {}
            response = await client.get(url, params=params, headers=self.headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data.get("errorCode") == 0:
                    return data.get("result")
            return None

    async def get_flight_route(self, session_id: str, flight_id: str) -> List[Dict[str, Any]]:
        if self.is_mock:
            return []
            
        async with httpx.AsyncClient() as client:
            url = f"{BASE_URL}/sessions/{session_id}/flights/{flight_id}/route"
            params = {"apikey": self.api_key} if self.api_key else {}
            response = await client.get(url, params=params, headers=self.headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data.get("errorCode") == 0:
                    return data.get("result", [])
            return []
