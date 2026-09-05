from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.account import ORMModel


class LiabilityResponse(ORMModel):
    id: int
    type: str
    name: str
    institution: str | None
    original_amount: Decimal
    current_balance: Decimal
    interest_rate: Decimal | None
    due_day: int | None
    notes: str | None
    is_active: bool


class LiabilityCreate(BaseModel):
    type: str
    name: str
    institution: str | None = None
    original_amount: Decimal = Decimal("0")
    current_balance: Decimal
    interest_rate: Decimal | None = None
    due_day: int | None = None
    notes: str | None = None


class LiabilityUpdate(BaseModel):
    type: str | None = None
    name: str | None = None
    institution: str | None = None
    original_amount: Decimal | None = None
    current_balance: Decimal | None = None
    interest_rate: Decimal | None = None
    due_day: int | None = None
    notes: str | None = None
    is_active: bool | None = None


class LiabilityTransactionResponse(ORMModel):
    id: int
    liability_id: int
    transaction_date: date
    type: str
    amount: Decimal
    memo: str | None


class LiabilityTransactionCreate(BaseModel):
    transaction_date: date
    type: str
    amount: Decimal
    memo: str | None = None
