from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Account, AccountYearlyLimit, DailySnapshot, LedgerTransaction
from app.routers.holdings import refresh_prices
from app.routers.recurring_items import generate_recurring_items
from app.schemas.account import RefreshPricesRequest
from app.schemas.dashboard import (
    AccountOverviewItem,
    AccountPerformanceItem,
    AssetBreakdown,
    CashflowSummary,
    CashflowTrendPoint,
    CashflowTrendResponse,
    DashboardOverview,
    DashboardRefreshResponse,
    LimitAlert,
    NetWorthSummary,
    NetWorthTrendResponse,
    TrendPoint,
)
from app.schemas.ledger import RecurringGenerateRequest
from app.services.core import aggregate_assets, get_account_total_value, save_daily_snapshot
from app.utils import holding_cost_basis, holding_market_value, to_decimal
from app.models import Holding

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
def dashboard_overview(db: Session = Depends(get_db)):
    totals = aggregate_assets(db)
    today = date.today()
    income = (
        db.query(func.coalesce(func.sum(LedgerTransaction.amount), 0))
        .filter(
            LedgerTransaction.type == "income",
            func.strftime("%Y", LedgerTransaction.transaction_date) == str(today.year),
            func.strftime("%m", LedgerTransaction.transaction_date) == f"{today.month:02d}",
        )
        .scalar()
    )
    expense = (
        db.query(func.coalesce(func.sum(LedgerTransaction.amount), 0))
        .filter(
            LedgerTransaction.type == "expense",
            func.strftime("%Y", LedgerTransaction.transaction_date) == str(today.year),
            func.strftime("%m", LedgerTransaction.transaction_date) == f"{today.month:02d}",
        )
        .scalar()
    )
    income = to_decimal(income)
    expense = to_decimal(expense)
    total_assets = totals["total_assets"]
    investment_ratio = (
        totals["investment_total"] / total_assets * 100 if total_assets > 0 else Decimal("0")
    )
    cash_ratio = totals["cash_total"] / total_assets * 100 if total_assets > 0 else Decimal("0")

    accounts = (
        db.query(Account)
        .options(joinedload(Account.account_type))
        .filter(Account.is_active.is_(True))
        .all()
    )
    accounts_summary = []
    for account in accounts:
        value = get_account_total_value(db, account)
        ratio = value / total_assets * 100 if total_assets > 0 else Decimal("0")
        accounts_summary.append(
            AccountOverviewItem(
                account_id=account.id,
                name=account.name,
                type=account.account_type.name,
                category=account.account_type.category,
                total_value=value,
                ratio=ratio.quantize(Decimal("0.01")),
            )
        )
    accounts_summary.sort(key=lambda item: item.ratio, reverse=True)

    from app.routers.budgets import budget_alerts

    alerts = budget_alerts(year=today.year, month=today.month, db=db)
    limit_rows = (
        db.query(AccountYearlyLimit)
        .options(joinedload(AccountYearlyLimit.account))
        .filter(AccountYearlyLimit.year == today.year)
        .all()
    )
    limit_alerts = []
    for row in limit_rows:
        if not row.account or not row.account.is_active:
            continue
        limit = to_decimal(row.contribution_limit)
        if limit <= 0:
            continue
        contributed = to_decimal(row.contributed_amount)
        remaining = limit - contributed
        usage_rate = contributed / limit * 100
        limit_alerts.append(
            LimitAlert(
                account_name=row.account.name if row.account else "",
                usage_rate=usage_rate.quantize(Decimal("0.01")),
                remaining=remaining,
            )
        )

    return DashboardOverview(
        as_of=datetime.utcnow(),
        net_worth=NetWorthSummary(
            total_assets=totals["total_assets"],
            total_liabilities=totals["total_liabilities"],
            net_worth=totals["net_worth"],
        ),
        asset_breakdown=AssetBreakdown(
            investment=totals["investment_total"],
            cash=totals["cash_total"],
            investment_ratio=investment_ratio.quantize(Decimal("0.01")),
            cash_ratio=cash_ratio.quantize(Decimal("0.01")),
        ),
        cashflow=CashflowSummary(
            year=today.year,
            month=today.month,
            total_income=income,
            total_expense=expense,
            net=income - expense,
        ),
        accounts_summary=accounts_summary,
        budget_alerts_count=len(alerts.over_budget),
        limit_alerts=limit_alerts,
    )


@router.get("/net-worth-trend", response_model=NetWorthTrendResponse)
def net_worth_trend(
    from_date: date | None = None,
    to_date: date | None = None,
    db: Session = Depends(get_db),
):
    to_date = to_date or date.today()
    from_date = from_date or (to_date - timedelta(days=30))
    save_daily_snapshot(db, to_date)
    rows = (
        db.query(DailySnapshot)
        .filter(DailySnapshot.snapshot_date >= from_date, DailySnapshot.snapshot_date <= to_date)
        .order_by(DailySnapshot.snapshot_date.asc())
        .all()
    )
    return NetWorthTrendResponse(
        data=[
            TrendPoint(
                date=row.snapshot_date,
                total_assets=row.total_assets,
                total_liabilities=row.total_liabilities,
                net_worth=row.net_worth,
            )
            for row in rows
        ]
    )


@router.get("/cashflow-trend", response_model=CashflowTrendResponse)
def cashflow_trend(months: int = Query(default=6, ge=1, le=24), db: Session = Depends(get_db)):
    today = date.today()
    data: list[CashflowTrendPoint] = []
    year = today.year
    month = today.month
    for _ in range(months):
        income = (
            db.query(func.coalesce(func.sum(LedgerTransaction.amount), 0))
            .filter(
                LedgerTransaction.type == "income",
                func.strftime("%Y", LedgerTransaction.transaction_date) == str(year),
                func.strftime("%m", LedgerTransaction.transaction_date) == f"{month:02d}",
            )
            .scalar()
        )
        expense = (
            db.query(func.coalesce(func.sum(LedgerTransaction.amount), 0))
            .filter(
                LedgerTransaction.type == "expense",
                func.strftime("%Y", LedgerTransaction.transaction_date) == str(year),
                func.strftime("%m", LedgerTransaction.transaction_date) == f"{month:02d}",
            )
            .scalar()
        )
        income = to_decimal(income)
        expense = to_decimal(expense)
        data.append(
            CashflowTrendPoint(year=year, month=month, income=income, expense=expense, net=income - expense)
        )
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    data.reverse()
    return CashflowTrendResponse(data=data)


@router.get("/account-performance", response_model=list[AccountPerformanceItem])
def account_performance(account_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Account).options(joinedload(Account.account_type)).filter(Account.is_active.is_(True))
    if account_id:
        query = query.filter(Account.id == account_id)
    accounts = query.all()
    results = []
    for account in accounts:
        if not account.account_type.supports_holdings:
            continue
        holdings = db.query(Holding).filter(Holding.account_id == account.id, Holding.quantity > 0).all()
        market_value = sum((holding_market_value(h) for h in holdings), Decimal("0"))
        cost_basis = sum((holding_cost_basis(h) for h in holdings), Decimal("0"))
        profit_loss = market_value - cost_basis
        profit_loss_rate = (profit_loss / cost_basis * 100) if cost_basis > 0 else Decimal("0")
        results.append(
            AccountPerformanceItem(
                account_id=account.id,
                name=account.name,
                cost_basis=cost_basis,
                market_value=market_value + to_decimal(account.cash_balance),
                profit_loss=profit_loss,
                profit_loss_rate=profit_loss_rate.quantize(Decimal("0.01")),
            )
        )
    return results


@router.post("/refresh", response_model=DashboardRefreshResponse)
def dashboard_refresh(db: Session = Depends(get_db)):
    prices = refresh_prices(RefreshPricesRequest(), db)
    today = date.today()
    recurring = generate_recurring_items(
        RecurringGenerateRequest(year=today.year, month=today.month),
        db,
    )
    save_daily_snapshot(db, today)
    return DashboardRefreshResponse(
        prices_updated=prices.updated,
        recurring_generated=recurring.generated,
        snapshot_saved=True,
    )
