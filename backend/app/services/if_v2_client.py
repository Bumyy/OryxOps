import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import settings


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

@dataclass
class SessionInfo:
    id: str
    name: str
    max_users: int
    user_count: int
    type: int
    world_type: int
    minimum_grade_level: int
    minimum_app_version: str
    maximum_app_version: str | None = None


@dataclass
class FlightEntry:
    flight_id: str
    user_id: str
    aircraft_id: str
    livery_id: str
    username: str | None
    virtual_organization: str | None
    callsign: str
    latitude: float
    longitude: float
    altitude: float
    speed: float
    vertical_speed: float
    track: float
    heading: float
    last_report: str
    pilot_state: int
    is_connected: bool


@dataclass
class Coordinate:
    latitude: float
    longitude: float
    altitude: float


@dataclass
class FlightPlanItem:
    name: str
    type: int
    children: list["FlightPlanItem"] | None
    identifier: str | None
    altitude: int
    location: Coordinate | None


@dataclass
class FlightPlanInfo:
    flight_plan_id: str
    flight_id: str
    waypoints: list[str]
    last_update: str
    flight_plan_items: list[FlightPlanItem]
    flight_plan_type: int


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class IFV2Error(Exception):
    def __init__(self, status_code: int, error_code: int, detail: str = ""):
        self.status_code = status_code
        self.error_code = error_code
        self.detail = detail
        super().__init__(f"IF v2 API error {error_code} (HTTP {status_code}): {detail}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_v2_response(response: httpx.Response) -> Any:
    if response.is_success:
        body = response.json()
        error_code = body.get("errorCode", -1)
        if error_code == 0:
            return body.get("result")
        raise IFV2Error(response.status_code, error_code, body.get("error", ""))
    try:
        body = response.json()
    except Exception:
        body = {}
    error_code = body.get("errorCode", response.status_code)
    detail = body.get("error", body.get("detail", response.text))
    raise IFV2Error(response.status_code, error_code, detail)


def _safe_float(val: Any) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def _build_session(raw: dict) -> SessionInfo:
    return SessionInfo(
        id=raw["id"],
        name=raw["name"],
        max_users=int(raw.get("maxUsers", 0)),
        user_count=int(raw.get("userCount", 0)),
        type=int(raw.get("type", 0)),
        world_type=int(raw.get("worldType", 0)),
        minimum_grade_level=int(raw.get("minimumGradeLevel", 0)),
        minimum_app_version=str(raw.get("minimumAppVersion", "")),
        maximum_app_version=raw.get("maximumAppVersion"),
    )


def _build_flight_entry(raw: dict) -> FlightEntry:
    return FlightEntry(
        flight_id=raw["flightId"],
        user_id=raw["userId"],
        aircraft_id=raw["aircraftId"],
        livery_id=raw["liveryId"],
        username=raw.get("username"),
        virtual_organization=raw.get("virtualOrganization"),
        callsign=raw.get("callsign", ""),
        latitude=_safe_float(raw.get("latitude")),
        longitude=_safe_float(raw.get("longitude")),
        altitude=_safe_float(raw.get("altitude")),
        speed=_safe_float(raw.get("speed")),
        vertical_speed=_safe_float(raw.get("verticalSpeed")),
        track=_safe_float(raw.get("track")),
        heading=_safe_float(raw.get("heading")),
        last_report=str(raw.get("lastReport", "")),
        pilot_state=int(raw.get("pilotState", 0)),
        is_connected=bool(raw.get("isConnected", True)),
    )


def _build_coordinate(raw: dict | None) -> Coordinate | None:
    if raw is None:
        return None
    return Coordinate(
        latitude=_safe_float(raw.get("latitude")),
        longitude=_safe_float(raw.get("longitude")),
        altitude=_safe_float(raw.get("altitude")),
    )


def _build_flight_plan_item(raw: dict) -> FlightPlanItem:
    children = None
    if raw.get("children") is not None:
        children = [_build_flight_plan_item(c) for c in raw["children"]]
    return FlightPlanItem(
        name=raw.get("name", ""),
        type=int(raw.get("type", 5)),
        children=children,
        identifier=raw.get("identifier"),
        altitude=int(raw.get("altitude", -1)),
        location=_build_coordinate(raw.get("location")),
    )


def _build_flight_plan(raw: dict) -> FlightPlanInfo:
    items_raw = raw.get("flightPlanItems")
    items = [_build_flight_plan_item(i) for i in items_raw] if items_raw else []
    return FlightPlanInfo(
        flight_plan_id=raw["flightPlanId"],
        flight_id=raw["flightId"],
        waypoints=[str(w) for w in (raw.get("waypoints") or [])],
        last_update=str(raw.get("lastUpdate", "")),
        flight_plan_items=items,
        flight_plan_type=int(raw.get("flightPlanType", 0)),
    )


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class IFV2Client:
    """Async HTTP client for Infinite Flight Public API v2 (sessions, flights, flightplans).

    Uses the API key (``if_api_key`` in settings) for authentication. This is the
    public multiplayer data API, not the OAuth-based v3 organization API.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://api.infiniteflight.com/public/v2",
        timeout: float = 30.0,
    ):
        self.api_key = api_key or settings.if_api_key
        self.base_url = base_url.rstrip("/")
        self._client: httpx.AsyncClient | None = None
        self._timeout = timeout

    async def __aenter__(self):
        await self.open()
        return self

    async def __aexit__(self, *args):
        await self.close()

    @property
    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("Use 'async with IFV2Client(...)' or call .open() first")
        return self._client

    async def open(self):
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Accept": "application/json",
                },
                timeout=self._timeout,
            )
        return self

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    async def list_sessions(self) -> list[SessionInfo]:
        response = await self._http.get("/sessions")
        return [_build_session(s) for s in _parse_v2_response(response)]

    async def get_expert_session(self) -> SessionInfo | None:
        sessions = await self.list_sessions()
        for s in sessions:
            if s.world_type == 3:
                return s
        return None

    # ------------------------------------------------------------------
    # Flights
    # ------------------------------------------------------------------

    async def list_session_flights(self, session_id: str) -> list[FlightEntry]:
        response = await self._http.get(f"/sessions/{session_id}/flights")
        return [_build_flight_entry(f) for f in _parse_v2_response(response)]

    # ------------------------------------------------------------------
    # Flight Plans (bulk)
    # ------------------------------------------------------------------

    async def get_flight_plans(
        self, session_id: str, flight_ids: list[str]
    ) -> list[FlightPlanInfo | None]:
        if len(flight_ids) > 10:
            raise ValueError("Maximum 10 flight IDs per request")

        response = await self._http.post(
            f"/sessions/{session_id}/flights/flightplans",
            json={"flightIds": flight_ids},
        )
        results = _parse_v2_response(response)
        out: list[FlightPlanInfo | None] = []
        for item in results or []:
            if item is None:
                out.append(None)
            else:
                out.append(_build_flight_plan(item))
        return out


# ---------------------------------------------------------------------------
# Geo helpers (shared with tracking service)
# ---------------------------------------------------------------------------

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in nautical miles."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return 3440.065 * c


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from point 1 to point 2 in degrees (0-360)."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360
