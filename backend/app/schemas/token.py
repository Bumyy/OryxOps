from pydantic import BaseModel


class TokenBalanceOut(BaseModel):
    balance: int
    total_earned: int
    total_spent: int

    model_config = {"from_attributes": True}


class TokenTransactionOut(BaseModel):
    id: int
    amount: int
    transaction_type: str
    reference_id: int | None = None
    description: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


class TokenGrantRequest(BaseModel):
    pilot_id: int
    amount: int
    description: str | None = None


class TokenRemoveRequest(BaseModel):
    pilot_id: int
    amount: int
    description: str | None = None
