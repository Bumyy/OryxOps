from pydantic import BaseModel


class TransferOut(BaseModel):
    id: int
    pilot_id: int
    pilot_callsign: str | None = None
    transfer_type: str
    from_value: str | None = None
    to_value: str
    reason: str | None = None
    status: str
    requested_at: str
    reviewed_by: int | None = None
    reviewed_by_name: str | None = None
    reviewed_at: str | None = None

    model_config = {"from_attributes": True}


class TransferCreate(BaseModel):
    transfer_type: str
    from_value: str | None = None
    to_value: str
    reason: str | None = None


class TransferReview(BaseModel):
    status: str
