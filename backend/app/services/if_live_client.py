import base64
import hashlib
import os
import re
import secrets
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import IntEnum
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


# ---------------------------------------------------------------------------
# IF PublicApi v3 enums
# ---------------------------------------------------------------------------

class PersistentOrganizationType(IntEnum):
    AUTO_JOIN = 0
    MANUAL_JOIN = 1
    APPLY_TO_JOIN = 2
    INVITE_ONLY = 3
    SINGLE_MEMBER = 4


class OrganizationOperationType(IntEnum):
    UNDEFINED = 0
    AIRLINE = 1
    CHARTER = 2
    FREIGHT = 3
    MILITARY = 4
    FLIGHT_SCHOOL = 5
    PRIVATE = 6


class WorldType(IntEnum):
    SOLO = 0
    CASUAL = 1
    TRAINING = 2
    EXPERT = 3
    PRIVATE = 4


class PersistentOrganizationRecordStatus(IntEnum):
    ACTIVE = 0
    SUSPENDED = 1
    DELETED = 2


class PersistentAircraftRecordStatus(IntEnum):
    ACTIVE = 0
    DELETED = 1


class PersistentAircraftVisibility(IntEnum):
    UNKNOWN = 0
    VISIBLE = 1
    HANGARED = 2


class ScheduledFlightStatus(IntEnum):
    UNKNOWN = 0
    SCHEDULED = 1
    BOARDING = 2
    BOARDED = 3
    TAXIING_TO_RUNWAY = 4
    IN_FLIGHT = 6
    DIVERTED = 7
    DELAYED = 8
    CANCELLED = 9
    TAXIING_TO_PARKING = 10
    ARRIVED = 11


class PersistentFlightType(IntEnum):
    NONE = 0
    COMMERCIAL = 1
    CHARTER = 2
    CARGO = 3
    TRAINING = 4
    TEST_FLIGHT = 5
    MEDICAL_EMERGENCY = 6
    MILITARY = 7
    VIP_EXECUTIVE = 8
    HUMANITARIAN_RELIEF = 9
    GENERAL_AVIATION = 10
    AIRSHOW = 11
    OTHER = 12


# ---------------------------------------------------------------------------
# IF API response models (dataclasses are fine — no DB persistence needed)
# ---------------------------------------------------------------------------

@dataclass
class IFOrganization:
    id: str
    name: str
    type: int
    operation_type: int
    world_type: int
    status: int
    description: str | None = None


@dataclass
class IFAircraft:
    id: str
    aircraft_id: str
    organization_id: str
    registration: str
    status: int
    visibility: int
    created_at: str


@dataclass
class IFSchedule:
    id: str
    status: int
    callsign: str
    organization_id: str
    aircraft_id: str
    flight_type: int
    origin_icao: str
    destination_icao: str
    scheduled_departure_utc: str
    scheduled_arrival_utc: str
    actual_departure_utc: str | None = None
    actual_arrival_utc: str | None = None
    briefing: str | None = None
    debriefing: str | None = None
    flight_plan: str | None = None
    sequence: int = 0
    created_at: str = ""
    updated_at: str = ""


@dataclass
class IFScheduleRequest:
    callsign: str
    flight_type: PersistentFlightType
    origin_icao: str
    destination_icao: str
    scheduled_departure_utc: str
    scheduled_arrival_utc: str
    briefing: str | None = None
    flight_plan: str | None = None


@dataclass
class IFScheduleFlightPlanRequest:
    flight_plan: str | None = None


@dataclass
class IFScheduleReorderRequest:
    schedule_id: str
    after_id: str | None = None


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class IFLiveError(Exception):
    """Raised when the IF API returns a non-zero errorCode."""

    def __init__(self, status_code: int, error_code: int, detail: str = ""):
        self.status_code = status_code
        self.error_code = error_code
        self.detail = detail
        super().__init__(f"IF API error {error_code} (HTTP {status_code}): {detail}")


class IFLiveAuthError(IFLiveError):
    """401 — missing, expired, or invalid bearer token."""


class IFLiveForbiddenError(IFLiveError):
    """403 — missing scope, disabled client, testing-only client, or no access."""


class IFLiveNotFoundError(IFLiveError):
    """404 — resource not found for the signed-in user."""


class IFLiveRateLimitError(IFLiveError):
    """429 — rate limit exceeded."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_STATUS_ERROR_MAP = {
    401: IFLiveAuthError,
    403: IFLiveForbiddenError,
    404: IFLiveNotFoundError,
    429: IFLiveRateLimitError,
}


def _parse_if_response(response: httpx.Response) -> Any:
    """Extract ``result`` from the IF PublicApi response envelope.

    Raises an appropriate ``IFLiveError`` on failure.
    """
    if response.is_success:
        body = response.json()
        error_code = body.get("errorCode", -1)
        if error_code == 0:
            return body.get("result")
        raise IFLiveError(response.status_code, error_code, body.get("error", ""))

    try:
        body = response.json()
    except Exception:
        body = {}

    error_code = body.get("errorCode", response.status_code)
    detail = body.get("error", body.get("detail", response.text))
    exc_cls = _STATUS_ERROR_MAP.get(response.status_code, IFLiveError)
    raise exc_cls(response.status_code, error_code, detail)


def _build_if_org(raw: dict) -> IFOrganization:
    return IFOrganization(
        id=raw["id"],
        name=raw["name"],
        type=raw["type"],
        operation_type=raw["operationType"],
        world_type=raw["worldType"],
        status=raw["status"],
        description=raw.get("description"),
    )


def _build_if_aircraft(raw: dict) -> IFAircraft:
    return IFAircraft(
        id=raw["id"],
        aircraft_id=raw["aircraftId"],
        organization_id=raw["organizationId"],
        registration=raw["registration"],
        status=raw["status"],
        visibility=raw["visibility"],
        created_at=raw["createdAt"],
    )


def _build_if_schedule(raw: dict) -> IFSchedule:
    return IFSchedule(
        id=raw["id"],
        status=raw["status"],
        callsign=raw["callsign"],
        organization_id=raw["organizationId"],
        aircraft_id=raw["aircraftId"],
        flight_type=raw["flightType"],
        origin_icao=raw["originIcao"],
        destination_icao=raw["destinationIcao"],
        scheduled_departure_utc=raw["scheduledDepartureUtc"],
        scheduled_arrival_utc=raw["scheduledArrivalUtc"],
        actual_departure_utc=raw.get("actualDepartureUtc"),
        actual_arrival_utc=raw.get("actualArrivalUtc"),
        briefing=raw.get("briefing"),
        debriefing=raw.get("debriefing"),
        flight_plan=raw.get("flightPlan"),
        sequence=raw.get("sequence", 0),
        created_at=raw.get("createdAt", ""),
        updated_at=raw.get("updatedAt", ""),
    )


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class IFLiveClient:
    """Async HTTP client for the Infinite Flight PublicApi v3 Live endpoints.

    Typical usage::

        async with IFLiveClient(access_token) as client:
            orgs = await client.list_organizations()
            for org in orgs:
                aircraft = await client.list_organization_aircraft(org.id)
                for ac in aircraft:
                    schedules = await client.list_aircraft_schedules(ac.id)
    """

    def __init__(
        self,
        access_token: str,
        base_url: str | None = None,
        timeout: float = 30.0,
    ):
        self.access_token = access_token
        self.base_url = (base_url or settings.if_api_base_url).rstrip("/")
        self._client: httpx.AsyncClient | None = None
        self._timeout = timeout

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Accept": "application/json",
            },
            timeout=self._timeout,
        )
        return self

    async def __aexit__(self, *args):
        if self._client:
            await self._client.aclose()

    @property
    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("Use 'async with IFLiveClient(...)' or call .open() first")
        return self._client

    async def open(self):
        """Open the underlying HTTP client without a context manager."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.access_token}",
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
    # Organizations
    # ------------------------------------------------------------------

    async def list_organizations(self) -> list[IFOrganization]:
        response = await self._http.get("/live/organizations")
        return [_build_if_org(o) for o in _parse_if_response(response)]

    async def get_organization(self, organization_id: str) -> IFOrganization:
        response = await self._http.get(f"/live/organizations/{organization_id}")
        return _build_if_org(_parse_if_response(response))

    async def list_organization_aircraft(self, organization_id: str) -> list[IFAircraft]:
        response = await self._http.get(f"/live/organizations/{organization_id}/aircraft")
        return [_build_if_aircraft(a) for a in _parse_if_response(response)]

    # ------------------------------------------------------------------
    # Aircraft
    # ------------------------------------------------------------------

    async def get_aircraft(self, aircraft_id: str) -> IFAircraft:
        response = await self._http.get(f"/live/aircraft/{aircraft_id}")
        return _build_if_aircraft(_parse_if_response(response))

    # ------------------------------------------------------------------
    # Schedules — read
    # ------------------------------------------------------------------

    async def list_aircraft_schedules(self, aircraft_id: str) -> list[IFSchedule]:
        response = await self._http.get(f"/live/aircraft/{aircraft_id}/schedules")
        return [_build_if_schedule(s) for s in _parse_if_response(response)]

    # ------------------------------------------------------------------
    # Schedules — write
    # ------------------------------------------------------------------

    async def create_schedule(
        self, aircraft_id: str, data: IFScheduleRequest
    ) -> IFSchedule:
        response = await self._http.post(
            f"/live/aircraft/{aircraft_id}/schedules",
            json=_schedule_request_body(data),
        )
        return _build_if_schedule(_parse_if_response(response))

    async def update_schedule(
        self, schedule_id: str, data: IFScheduleRequest
    ) -> IFSchedule:
        response = await self._http.put(
            f"/live/schedules/{schedule_id}",
            json=_schedule_request_body(data),
        )
        return _build_if_schedule(_parse_if_response(response))

    async def update_flightplan(
        self, schedule_id: str, flight_plan: str | None
    ) -> IFSchedule:
        response = await self._http.put(
            f"/live/schedules/{schedule_id}/flightplan",
            json={"flightPlan": flight_plan if flight_plan else None},
        )
        return _build_if_schedule(_parse_if_response(response))

    async def reorder_schedules(
        self, aircraft_id: str, schedule_id: str, after_id: str | None = None
    ) -> bool:
        response = await self._http.put(
            f"/live/aircraft/{aircraft_id}/schedules/reorder",
            json={"scheduleId": schedule_id, "afterId": after_id},
        )
        return _parse_if_response(response) is True

    async def delete_schedule(self, schedule_id: str) -> bool:
        response = await self._http.delete(f"/live/schedules/{schedule_id}")
        return _parse_if_response(response) is True


# ---------------------------------------------------------------------------
# OAuth2 token helpers (stateless — use with httpx directly)
# ---------------------------------------------------------------------------


async def exchange_authorization_code(
    code: str,
    code_verifier: str,
    client_id: str | None = None,
    client_secret: str | None = None,
    redirect_uri: str | None = None,
    auth_base_url: str | None = None,
) -> dict:
    """Exchange an OAuth2 authorization code for tokens.

    Returns the token response dict::

        {"access_token": "...", "token_type": "Bearer", "expires_in": 1800, "refresh_token": "..."}
    """
    base = (auth_base_url or settings.if_auth_base_url).rstrip("/")
    body = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri or settings.if_redirect_uri,
        "code_verifier": code_verifier,
        "client_id": client_id or settings.if_client_id,
    }
    if client_secret or settings.if_client_secret:
        body["client_secret"] = client_secret or settings.if_client_secret

    async with httpx.AsyncClient() as http:
        response = await http.post(
            f"{base}/connect/token",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.is_success:
            return response.json()
        raise IFLiveAuthError(
            response.status_code,
            0,
            response.json().get("error_description", response.text),
        )


async def refresh_access_token(
    refresh_token: str,
    client_id: str | None = None,
    client_secret: str | None = None,
    auth_base_url: str | None = None,
) -> dict:
    """Refresh an expired access token.

    Returns a new token response dict (refresh-token rotation applies).
    """
    base = (auth_base_url or settings.if_auth_base_url).rstrip("/")
    body = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id or settings.if_client_id,
    }
    if client_secret or settings.if_client_secret:
        body["client_secret"] = client_secret or settings.if_client_secret

    async with httpx.AsyncClient() as http:
        response = await http.post(
            f"{base}/connect/token",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.is_success:
            return response.json()
        raise IFLiveAuthError(
            response.status_code,
            0,
            response.json().get("error_description", response.text),
        )


def _schedule_request_body(data: IFScheduleRequest) -> dict:
    body: dict[str, Any] = {
        "callsign": data.callsign,
        "flightType": int(data.flight_type),
        "originIcao": data.origin_icao.upper(),
        "destinationIcao": data.destination_icao.upper(),
        "scheduledDepartureUtc": data.scheduled_departure_utc,
        "scheduledArrivalUtc": data.scheduled_arrival_utc,
    }
    if data.briefing is not None:
        body["briefing"] = data.briefing
    if data.flight_plan is not None:
        body["flightPlan"] = data.flight_plan
    return body


# ---------------------------------------------------------------------------
# PKCE utilities (RFC 7636)
# ---------------------------------------------------------------------------

def generate_code_verifier(length: int = 64) -> str:
    """Generate a cryptographically random PKCE code_verifier."""
    return secrets.token_urlsafe(length)[:128]


def generate_code_challenge(code_verifier: str) -> str:
    """Derive the S256 code_challenge from a code_verifier."""
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


# ---------------------------------------------------------------------------
# OAuth2 token manager (persistent)
# ---------------------------------------------------------------------------

DEFAULT_SCOPES = (
    "openid profile offline_access "
    "live:organizations.read live:aircraft.read live:schedules.read live:schedules.write"
)


class IFTokenManager:
    """Manages the full OAuth2 lifecycle for a single pilot.

    Stores tokens in the ``live_if_oauth_tokens`` table so the backend can
    use the admin's credentials indefinitely (with refresh).

    Typical flow::

        manager = IFTokenManager()

        # Step 1 — start the flow
        auth_url, state, verifier = await manager.begin_authorization(db, pilot_id)

        # Step 2 — after IF redirects back with ?code=...&state=...
        await manager.handle_callback(db, pilot_id, code, state)

        # Step 3 — use the token
        async with await manager.get_client(db, pilot_id) as client:
            orgs = await client.list_organizations()
    """

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        redirect_uri: str | None = None,
        auth_base_url: str | None = None,
        api_base_url: str | None = None,
        scopes: str | None = None,
    ):
        self.client_id = client_id or settings.if_client_id
        self.client_secret = client_secret or settings.if_client_secret
        self.redirect_uri = redirect_uri or settings.if_redirect_uri
        self.auth_base_url = (auth_base_url or settings.if_auth_base_url).rstrip("/")
        self.api_base_url = (api_base_url or settings.if_api_base_url).rstrip("/")
        self.scopes = scopes or DEFAULT_SCOPES

    # ------------------------------------------------------------------
    # Step 1 — build authorize URL
    # ------------------------------------------------------------------

    def build_authorize_url(self, state: str | None = None, code_challenge: str | None = None) -> tuple[str, str, str]:
        """Return ``(authorize_url, state, code_verifier)``.

        The caller must store ``state`` and the backend session so the
        callback can be validated.  The code_verifier is needed for token
        exchange.
        """
        code_verifier = generate_code_verifier()
        challenge = code_challenge or generate_code_challenge(code_verifier)
        state = state or secrets.token_urlsafe(32)

        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": self.scopes,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
        url = f"{self.auth_base_url}/connect/authorize?{urllib.parse.urlencode(params)}"
        return url, state, code_verifier

    # ------------------------------------------------------------------
    # Step 1 (persistent) — store verifier in the DB
    # ------------------------------------------------------------------

    async def begin_authorization(self, db: AsyncSession, pilot_id: int) -> str:
        """Generate the authorize URL, persist state + verifier, return the URL.

        Uses a temporary session store so we can validate the state when
        the callback fires.
        """
        from app.models.live_models import LiveIFOAuthToken

        url, state, verifier = self.build_authorize_url()

        # Store state+verifier temporarily against the pilot
        result = await db.execute(
            select(LiveIFOAuthToken).where(LiveIFOAuthToken.pilot_id == pilot_id)
        )
        token_row: LiveIFOAuthToken | None = result.scalar_one_or_none()

        if token_row:
            token_row.access_token = f"pending:{state}:{verifier}"
            token_row.refresh_token = ""
            token_row.expires_at = datetime.now(timezone.utc)
        else:
            token_row = LiveIFOAuthToken(
                pilot_id=pilot_id,
                access_token=f"pending:{state}:{verifier}",
                refresh_token="",
                expires_at=datetime.now(timezone.utc),
            )
            db.add(token_row)

        await db.commit()
        return url

    # ------------------------------------------------------------------
    # Step 2 — exchange code for tokens and persist
    # ------------------------------------------------------------------

    async def handle_callback(
        self,
        db: AsyncSession,
        pilot_id: int,
        code: str,
        state: str,
    ) -> dict:
        """Exchange the authorization code, persist tokens, return token info."""
        from app.models.live_models import LiveIFOAuthToken

        result = await db.execute(
            select(LiveIFOAuthToken).where(LiveIFOAuthToken.pilot_id == pilot_id)
        )
        token_row: LiveIFOAuthToken | None = result.scalar_one_or_none()

        if token_row is None or not token_row.access_token.startswith("pending:"):
            raise IFLiveAuthError(400, 0, "No pending authorization — call begin_authorization first")

        _, saved_state, code_verifier = token_row.access_token.split(":", 2)
        if saved_state != state:
            raise IFLiveAuthError(400, 0, "State mismatch — possible CSRF attack")

        token_data = await exchange_authorization_code(
            code=code,
            code_verifier=code_verifier,
            client_id=self.client_id,
            client_secret=self.client_secret,
            redirect_uri=self.redirect_uri,
            auth_base_url=self.auth_base_url,
        )

        expires_in = token_data.get("expires_in", 1800)
        token_row.access_token = token_data["access_token"]
        token_row.refresh_token = token_data.get("refresh_token", "")
        token_row.expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        token_row.scope = token_data.get("scope")
        db.add(token_row)
        await db.commit()

        return token_data

    # ------------------------------------------------------------------
    # Step 3 — get a ready-to-use client (auto-refresh)
    # ------------------------------------------------------------------

    async def get_client(self, db: AsyncSession, pilot_id: int) -> IFLiveClient:
        """Return an ``IFLiveClient`` with a valid access token.

        Refreshes automatically if the stored token has expired.
        """
        from app.models.live_models import LiveIFOAuthToken

        result = await db.execute(
            select(LiveIFOAuthToken).where(LiveIFOAuthToken.pilot_id == pilot_id)
        )
        token_row: LiveIFOAuthToken | None = result.scalar_one_or_none()

        if token_row is None or not token_row.refresh_token:
            raise IFLiveAuthError(401, 0, "No stored token — authorize first")

        # Check expiry with 60-second buffer
        now = datetime.now(timezone.utc)
        expires = token_row.expires_at.replace(tzinfo=timezone.utc) if token_row.expires_at else now
        if expires < now + timedelta(seconds=60):
            await self._refresh(db, token_row)

        client = IFLiveClient(token_row.access_token, base_url=self.api_base_url)
        return client

    # ------------------------------------------------------------------
    # Explicit refresh
    # ------------------------------------------------------------------

    async def _refresh(self, db: AsyncSession, token_row) -> None:
        if not token_row.refresh_token:
            raise IFLiveAuthError(401, 0, "No refresh token available — re-authorize")

        token_data = await refresh_access_token(
            refresh_token=token_row.refresh_token,
            client_id=self.client_id,
            client_secret=self.client_secret,
            auth_base_url=self.auth_base_url,
        )
        expires_in = token_data.get("expires_in", 1800)
        token_row.access_token = token_data["access_token"]
        token_row.refresh_token = token_data.get("refresh_token", token_row.refresh_token)
        token_row.expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        db.add(token_row)
        await db.commit()

    async def revoke(self, db: AsyncSession, pilot_id: int) -> None:
        from app.models.live_models import LiveIFOAuthToken

        result = await db.execute(
            select(LiveIFOAuthToken).where(LiveIFOAuthToken.pilot_id == pilot_id)
        )
        token_row = result.scalar_one_or_none()
        if token_row:
            token_row.access_token = ""
            token_row.refresh_token = ""
            token_row.expires_at = datetime.now(timezone.utc)
            db.add(token_row)
            await db.commit()
