from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.account import ORMModel


class CardBrief(BaseModel):
    id: int
    name: str
    card_type: str
    institution: str | None = None
    last_four: str | None = None


class CardResponse(ORMModel):
    id: int
    name: str
    card_type: str
    institution: str | None
    last_four: str | None
    linked_account_id: int | None
    linked_account_name: str | None = None
    linked_liability_id: int | None
    linked_liability_name: str | None = None
    settlement_account_id: int | None
    settlement_account_name: str | None = None
    due_day: int | None
    is_active: bool


class CardCreate(BaseModel):
    name: str
    card_type: str = Field(pattern="^(debit|credit)$")
    institution: str | None = None
    last_four: str | None = Field(default=None, max_length=4)
    linked_account_id: int | None = None
    settlement_account_id: int | None = None
    due_day: int | None = Field(default=None, ge=1, le=31)


class CardUpdate(BaseModel):
    name: str | None = None
    institution: str | None = None
    last_four: str | None = Field(default=None, max_length=4)
    linked_account_id: int | None = None
    settlement_account_id: int | None = None
    due_day: int | None = Field(default=None, ge=1, le=31)
    is_active: bool | None = None


class CardSettlementResponse(ORMModel):
    id: int
    card_id: int
    card_name: str
    year: int
    month: int
    amount: Decimal
    settlement_date: date
