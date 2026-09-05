from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class NetWorthSummary(BaseModel):
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal


class AssetBreakdown(BaseModel):
    investment: Decimal
    cash: Decimal
    investment_ratio: Decimal
    cash_ratio: Decimal


class CashflowSummary(BaseModel):
    year: int
    month: int
    total_income: Decimal
    total_expense: Decimal
    net: Decimal


class AccountOverviewItem(BaseModel):
    account_id: int
    name: str
    type: str
    category: str
    total_value: Decimal
    ratio: Decimal


class LimitAlert(BaseModel):
    account_name: str
    usage_rate: Decimal
    remaining: Decimal


class DashboardOverview(BaseModel):
    as_of: datetime
    net_worth: NetWorthSummary
    asset_breakdown: AssetBreakdown
    cashflow: CashflowSummary
    accounts_summary: list[AccountOverviewItem]
    budget_alerts_count: int
    limit_alerts: list[LimitAlert]


class TrendPoint(BaseModel):
    date: date
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal


class NetWorthTrendResponse(BaseModel):
    data: list[TrendPoint]


class CashflowTrendPoint(BaseModel):
    year: int
    month: int
    income: Decimal
    expense: Decimal
    net: Decimal


class CashflowTrendResponse(BaseModel):
    data: list[CashflowTrendPoint]


class AccountPerformanceItem(BaseModel):
    account_id: int
    name: str
    cost_basis: Decimal
    market_value: Decimal
    profit_loss: Decimal
    profit_loss_rate: Decimal


class DashboardRefreshResponse(BaseModel):
    prices_updated: int
    recurring_generated: int
    snapshot_saved: bool
