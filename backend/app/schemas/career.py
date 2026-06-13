from pydantic import BaseModel


class CareerPathOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class CareerRankOut(BaseModel):
    id: int
    career_path_id: int
    name: str
    sort_order: int
    required_route_pct: float
    required_takeoffs: int
    required_landings: int

    model_config = {"from_attributes": True}


class CareerRankAircraftOut(BaseModel):
    id: int
    rank_name: str | None = None
    aircraft_type_id: int
    aircraft_name: str | None = None
    count: int

    model_config = {"from_attributes": True}


class CareerPathDetailOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    ranks: list[CareerRankOut] = []

    model_config = {"from_attributes": True}


class PilotCareerOut(BaseModel):
    id: int
    career_path_id: int
    career_path_name: str | None = None
    current_rank_id: int
    current_rank_name: str | None = None
    sort_order: int | None = None
    started_at: str | None = None
    promoted_at: str | None = None

    model_config = {"from_attributes": True}


class PilotCareerProgressOut(BaseModel):
    pilot_career: PilotCareerOut
    current_rank: CareerRankOut | None = None
    next_rank: CareerRankOut | None = None
    total_routes: int = 0
    discovered_routes: int = 0
    discovery_pct: float = 0.0
    route_pct_required: float = 0.0
    route_pct_complete: bool = False
    takeoffs_count: int = 0
    takeoffs_required: int = 0
    takeoffs_complete: bool = False
    landings_count: int = 0
    landings_required: int = 0
    landings_complete: bool = False
    can_promote: bool = False


class CareerRankCreate(BaseModel):
    name: str
    sort_order: int
    required_route_pct: float = 0.0
    required_takeoffs: int = 0
    required_landings: int = 0


class CareerRankUpdate(BaseModel):
    name: str | None = None
    required_route_pct: float | None = None
    required_takeoffs: int | None = None
    required_landings: int | None = None
