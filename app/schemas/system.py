from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.account import ORMModel


class AccountSnapshotPoint(BaseModel):
    snapshot_date: date
    balance_value: Decimal


class DailySnapshotResponse(ORMModel):
    id: int
    snapshot_date: date
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal
    investment_total: Decimal
    cash_total: Decimal


class MarketQuoteResponse(BaseModel):
    symbol: str
    name: str | None
    price: Decimal
    currency: str
    updated_at: datetime | None


class MarketSearchItem(BaseModel):
    symbol: str
    name: str


class MarketProviderStatus(BaseModel):
    provider: str
    configured: bool
    connected: bool
    message: str | None = None


class TossCredentialsUpdate(BaseModel):
    client_id: str
    client_secret: str


class HealthResponse(BaseModel):
    status: str
    db: str
    version: str


class InitializeResponse(BaseModel):
    account_types: int
    payment_methods: int
    categories: int
    message: str


class RestoreResponse(BaseModel):
    message: str
    restored_at: datetime
