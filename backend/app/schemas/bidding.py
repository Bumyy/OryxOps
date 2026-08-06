from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class BiddingSessionCreate(BaseModel):
    group_id: int
    slots_offered: int = 1
    bidding_fee_qar: int = 3000
    path_switch_fee_qar: int = 40000
    duration_days: int = 4
    notes: Optional[str] = None


class ApplicantHours(BaseModel):
    full_book_hours: float = 0.0
    only_dep_hours: float = 0.0
    only_arri_hours: float = 0.0
    total_hours: float = 0.0


class BiddingApplicantOut(BaseModel):
    id: int
    session_id: int
    pilot_id: int
    pilot_callsign: str
    pilot_name: Optional[str] = None
    current_group_name: Optional[str] = None
    path_switch_required: bool
    bidding_fee_paid: int
    path_switch_fee_paid: int
    status: str
    applied_at: str
    reviewed_at: Optional[str] = None
    admin_notes: Optional[str] = None
    hours_breakdown: Optional[ApplicantHours] = None

    class Config:
        from_attributes = True


class BiddingSessionOut(BaseModel):
    id: int
    group_id: int
    group_name: str
    slots_offered: int
    bidding_fee_qar: int
    path_switch_fee_qar: int
    status: str
    opens_at: str
    closes_at: str
    created_by: int
    creator_callsign: Optional[str] = None
    notes: Optional[str] = None
    applicant_count: int = 0
    user_applicant_status: Optional[str] = None
    user_path_switch_required: Optional[bool] = None
    applicants: Optional[List[BiddingApplicantOut]] = None

    class Config:
        from_attributes = True


class FinalizeBiddingRequest(BaseModel):
    winner_pilot_ids: List[int]
    admin_notes: Optional[str] = None
