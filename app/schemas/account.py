from datetime import date, datetime
from decimal import Decimal
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.utils import ASSET_CLASS_DEPOSIT, ASSET_CLASS_STOCK

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class AccountTypeBrief(ORMModel):
    id: int
    code: str
    name: str
    category: str
    supports_holdings: bool


class AccountTypeResponse(ORMModel):
    id: int
    code: str
    name: str
    category: str
    supports_holdings: bool
    supports_contribution_limit: bool
    sort_order: int
    is_system: bool


class AccountTypeCreate(BaseModel):
    code: str
    name: str
    category: str
    supports_holdings: bool = False
    supports_contribution_limit: bool = False
    sort_order: int = 0


class AccountSummary(BaseModel):
    holdings_count: int
    holdings_value: Decimal
    total_value: Decimal


class AccountResponse(ORMModel):
    id: int
    account_type_id: int
    account_type: AccountTypeBrief | None = None
    name: str
    institution: str | None
    cash_balance: Decimal
    metadata: dict[str, Any] = Field(default_factory=dict)
    is_active: bool
    summary: AccountSummary | None = None


class AccountCreate(BaseModel):
    account_type_id: int
    name: str
    institution: str | None = None
    cash_balance: Decimal = Decimal("0")
    metadata: dict[str, Any] | None = None


class AccountUpdate(BaseModel):
    account_type_id: int | None = None
    name: str | None = None
    institution: str | None = None
    cash_balance: Decimal | None = None
    metadata: dict[str, Any] | None = None
    is_active: bool | None = None


class HoldingResponse(ORMModel):
    id: int
    account_id: int
    account_name: str | None = None
    asset_class: str
    symbol: str
    name: str
    quantity: Decimal
    avg_cost_price: Decimal
    manual_price: Decimal | None
    last_market_price: Decimal | None
    last_price_updated_at: datetime | None
    current_price: Decimal
    market_value: Decimal
    cost_basis: Decimal
    profit_loss: Decimal
    profit_loss_rate: Decimal
    interest_rate: Decimal | None = None
    start_date: date | None = None
    maturity_date: date | None = None
    accrued_interest: Decimal | None = None


class HoldingCreate(BaseModel):
    account_id: int
    asset_class: str = ASSET_CLASS_STOCK
    symbol: str | None = None
    name: str
    quantity: Decimal
    avg_cost_price: Decimal | None = None
    interest_rate: Decimal | None = None
    start_date: date | None = None
    maturity_date: date | None = None

    @model_validator(mode="after")
    def validate_deposit(self):
        if self.asset_class == ASSET_CLASS_DEPOSIT:
            if self.avg_cost_price is None:
                self.avg_cost_price = Decimal("1")
            return self
        if not self.symbol:
            raise ValueError("symbol이 필요합니다.")
        if self.avg_cost_price is None:
            raise ValueError("avg_cost_price가 필요합니다.")
        return self


class HoldingUpdate(BaseModel):
    asset_class: str | None = None
    symbol: str | None = None
    name: str | None = None
    quantity: Decimal | None = None
    avg_cost_price: Decimal | None = None
    manual_price: Decimal | None = None
    interest_rate: Decimal | None = None
    start_date: date | None = None
    maturity_date: date | None = None


class RefreshPricesRequest(BaseModel):
    holding_ids: list[int] | None = None


class RefreshPricesResponse(BaseModel):
    updated: int
    failed: list[dict[str, Any]]


class InvestmentTransactionResponse(ORMModel):
    id: int
    account_id: int
    holding_id: int | None
    type: str
    transaction_date: date
    quantity: Decimal | None
    price: Decimal | None
    amount: Decimal
    fee: Decimal
    memo: str | None


class InvestmentTransactionCreate(BaseModel):
    account_id: int
    holding_id: int | None = None
    asset_class: str | None = None
    symbol: str | None = None
    name: str | None = None
    type: str
    transaction_date: date
    quantity: Decimal | None = None
    price: Decimal | None = None
    amount: Decimal
    fee: Decimal = Decimal("0")
    memo: str | None = None
    sync_to_ledger: bool = False
    ledger_category_id: int | None = None


class InvestmentTransactionUpdate(BaseModel):
    type: str | None = None
    transaction_date: date | None = None
    quantity: Decimal | None = None
    price: Decimal | None = None
    amount: Decimal | None = None
    fee: Decimal | None = None
    memo: str | None = None


class AccountLimitResponse(ORMModel):
    id: int
    account_id: int
    account_name: str | None = None
    year: int
    contribution_limit: Decimal
    contributed_amount: Decimal
    remaining_amount: Decimal
    usage_rate: Decimal


class AccountLimitUpsert(BaseModel):
    account_id: int
    year: int
    contribution_limit: Decimal
