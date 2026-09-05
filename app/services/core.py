from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Account,
    AccountSnapshot,
    AccountType,
    AccountYearlyLimit,
    Budget,
    Category,
    DailySnapshot,
    Holding,
    InvestmentTransaction,
    LedgerTransaction,
    Liability,
    LiabilitySnapshot,
    PaymentMethod,
    RecurringItem,
    Tag,
)
from app.utils import (
    dump_metadata,
    holding_accrued_interest,
    holding_cost_basis,
    holding_current_price,
    holding_market_value,
    is_deposit_holding,
    parse_metadata,
    to_decimal,
)


ACCOUNT_TYPE_SEEDS = [
    ("ISA", "ISA", "investment", True, True, 1),
    ("IRP", "IRP", "pension", True, True, 2),
    ("PENSION_SAVINGS", "연금저축", "pension", True, True, 3),
    ("DC_PENSION", "DC퇴직연금", "pension", True, False, 4),
    ("BROKERAGE", "일반증권", "investment", True, False, 5),
    ("SAVINGS", "적금", "deposit", False, False, 6),
    ("DEPOSIT", "예금", "deposit", False, False, 7),
    ("CHECKING", "입출금", "cash", False, False, 8),
]

PAYMENT_METHOD_SEEDS = ["현금", "카드", "계좌이체"]

CATEGORY_SEEDS = [
    ("expense", "식비", [("외식",), ("장보기",), ("카페",)]),
    ("expense", "교통", [("대중교통",), ("주유",), ("택시",)]),
    ("expense", "주거", [("월세",), ("관리비",), ("공과금",)]),
    ("expense", "생활", [("통신비",), ("의료",), ("쇼핑",), ("카드대금",)]),
    ("expense", "문화", [("여가",), ("구독",)]),
    ("income", "급여", [("본봉",), ("상여",)]),
    ("income", "기타수입", [("이자",), ("배당",), ("기타",)]),
]


def seed_account_types(db: Session) -> int:
    count = 0
    for code, name, category, holdings, limit_flag, sort_order in ACCOUNT_TYPE_SEEDS:
        existing = db.query(AccountType).filter(AccountType.code == code).first()
        if existing:
            existing.name = name
            existing.category = category
            existing.supports_holdings = holdings
            existing.supports_contribution_limit = limit_flag
            existing.sort_order = sort_order
            continue
        db.add(
            AccountType(
                code=code,
                name=name,
                category=category,
                supports_holdings=holdings,
                supports_contribution_limit=limit_flag,
                sort_order=sort_order,
                is_system=True,
            )
        )
        count += 1
    db.commit()
    return count


def seed_payment_methods(db: Session) -> int:
    count = 0
    for name in PAYMENT_METHOD_SEEDS:
        exists = db.query(PaymentMethod).filter(PaymentMethod.name == name).first()
        if exists:
            continue
        db.add(PaymentMethod(name=name, is_system=True))
        count += 1
    db.commit()
    return count


def seed_categories(db: Session) -> int:
    count = 0
    for cat_type, parent_name, children in CATEGORY_SEEDS:
        parent = db.query(Category).filter(Category.name == parent_name, Category.parent_id.is_(None)).first()
        if not parent:
            parent = Category(
                name=parent_name,
                type=cat_type,
                parent_id=None,
                is_system=True,
                sort_order=count,
            )
            db.add(parent)
            db.flush()
            count += 1
        for idx, (child_name,) in enumerate(children):
            exists = (
                db.query(Category)
                .filter(Category.name == child_name, Category.parent_id == parent.id)
                .first()
            )
            if exists:
                continue
            db.add(
                Category(
                    name=child_name,
                    type=cat_type,
                    parent_id=parent.id,
                    is_system=True,
                    sort_order=idx,
                )
            )
            count += 1
    db.commit()
    return count


def initialize_all(db: Session) -> dict[str, int]:
    return {
        "account_types": seed_account_types(db),
        "payment_methods": seed_payment_methods(db),
        "categories": seed_categories(db),
    }


def get_account_total_value(db: Session, account: Account) -> Decimal:
    holdings_value = Decimal("0")
    if account.account_type.supports_holdings:
        holdings = db.query(Holding).filter(Holding.account_id == account.id, Holding.quantity > 0).all()
        holdings_value = sum((holding_market_value(h) for h in holdings), Decimal("0"))
    return to_decimal(account.cash_balance) + holdings_value


def get_or_create_yearly_limit(db: Session, account_id: int, year: int) -> AccountYearlyLimit:
    limit = (
        db.query(AccountYearlyLimit)
        .filter(AccountYearlyLimit.account_id == account_id, AccountYearlyLimit.year == year)
        .first()
    )
    if not limit:
        limit = AccountYearlyLimit(account_id=account_id, year=year)
        db.add(limit)
        db.flush()
    return limit


def update_contributed_amount(db: Session, account_id: int, year: int) -> None:
    account = db.get(Account, account_id)
    if not account or not account.account_type.supports_contribution_limit:
        return
    total = (
        db.query(func.coalesce(func.sum(InvestmentTransaction.amount), 0))
        .filter(
            InvestmentTransaction.account_id == account_id,
            InvestmentTransaction.type.in_(["deposit", "buy"]),
            func.strftime("%Y", InvestmentTransaction.transaction_date) == str(year),
        )
        .scalar()
    )
    limit = get_or_create_yearly_limit(db, account_id, year)
    limit.contributed_amount = to_decimal(total)


def apply_buy(holding: Holding, quantity: Decimal, price: Decimal) -> None:
    old_qty = to_decimal(holding.quantity)
    new_qty = old_qty + quantity
    if new_qty <= 0:
        holding.quantity = Decimal("0")
        return
    old_cost = old_qty * to_decimal(holding.avg_cost_price)
    added_cost = quantity * price
    holding.avg_cost_price = (old_cost + added_cost) / new_qty
    holding.quantity = new_qty


def apply_sell(holding: Holding, quantity: Decimal) -> None:
    holding.quantity = max(to_decimal(holding.quantity) - quantity, Decimal("0"))


def remove_holding(db: Session, holding: Holding) -> None:
    db.query(InvestmentTransaction).filter(InvestmentTransaction.holding_id == holding.id).update(
        {InvestmentTransaction.holding_id: None}
    )
    db.delete(holding)


def get_or_create_tag(db: Session, name: str) -> Tag:
    tag = db.query(Tag).filter(Tag.name == name).first()
    if not tag:
        tag = Tag(name=name)
        db.add(tag)
        db.flush()
    return tag


def get_category_descendant_ids(db: Session, category_id: int) -> list[int]:
    ids = [category_id]
    children = db.query(Category.id).filter(Category.parent_id == category_id).all()
    for child in children:
        ids.extend(get_category_descendant_ids(db, child.id))
    return ids


def calculate_budget_spent(db: Session, category_id: int, year: int, month: int) -> Decimal:
    category_ids = get_category_descendant_ids(db, category_id)
    total = (
        db.query(func.coalesce(func.sum(LedgerTransaction.amount), 0))
        .filter(
            LedgerTransaction.type == "expense",
            LedgerTransaction.category_id.in_(category_ids),
            func.strftime("%Y", LedgerTransaction.transaction_date) == str(year),
            func.strftime("%m", LedgerTransaction.transaction_date) == f"{month:02d}",
        )
        .scalar()
    )
    return to_decimal(total)


def aggregate_assets(db: Session) -> dict[str, Decimal]:
    accounts = (
        db.query(Account)
        .options(joinedload(Account.account_type))
        .filter(Account.is_active.is_(True))
        .all()
    )
    investment_total = Decimal("0")
    cash_total = Decimal("0")
    deposit_total = Decimal("0")
    total_assets = Decimal("0")

    for account in accounts:
        value = get_account_total_value(db, account)
        total_assets += value
        category = account.account_type.category
        if category in ("investment", "pension"):
            investment_total += value
        elif category == "deposit":
            deposit_total += value
        else:
            cash_total += value

    liabilities = (
        db.query(func.coalesce(func.sum(Liability.current_balance), 0))
        .filter(Liability.is_active.is_(True))
        .scalar()
    )
    total_liabilities = to_decimal(liabilities)
    return {
        "total_assets": total_assets,
        "investment_total": investment_total,
        "cash_total": cash_total + deposit_total,
        "deposit_total": deposit_total,
        "checking_total": cash_total,
        "total_liabilities": total_liabilities,
        "net_worth": total_assets - total_liabilities,
    }


def save_daily_snapshot(db: Session, snapshot_date: date | None = None) -> DailySnapshot:
    snapshot_date = snapshot_date or date.today()
    totals = aggregate_assets(db)

    snapshot = db.query(DailySnapshot).filter(DailySnapshot.snapshot_date == snapshot_date).first()
    if not snapshot:
        snapshot = DailySnapshot(snapshot_date=snapshot_date)
        db.add(snapshot)

    snapshot.total_assets = totals["total_assets"]
    snapshot.total_liabilities = totals["total_liabilities"]
    snapshot.net_worth = totals["net_worth"]
    snapshot.investment_total = totals["investment_total"]
    snapshot.cash_total = totals["cash_total"]

    accounts = db.query(Account).filter(Account.is_active.is_(True)).all()
    for account in accounts:
        value = get_account_total_value(db, account)
        account_snapshot = (
            db.query(AccountSnapshot)
            .filter(
                AccountSnapshot.snapshot_date == snapshot_date,
                AccountSnapshot.account_id == account.id,
            )
            .first()
        )
        if not account_snapshot:
            account_snapshot = AccountSnapshot(
                snapshot_date=snapshot_date,
                account_id=account.id,
            )
            db.add(account_snapshot)
        account_snapshot.balance_value = value

    liabilities = db.query(Liability).filter(Liability.is_active.is_(True)).all()
    for liability in liabilities:
        liability_snapshot = (
            db.query(LiabilitySnapshot)
            .filter(
                LiabilitySnapshot.snapshot_date == snapshot_date,
                LiabilitySnapshot.liability_id == liability.id,
            )
            .first()
        )
        if not liability_snapshot:
            liability_snapshot = LiabilitySnapshot(
                snapshot_date=snapshot_date,
                liability_id=liability.id,
            )
            db.add(liability_snapshot)
        liability_snapshot.balance_value = liability.current_balance

    db.commit()
    db.refresh(snapshot)
    return snapshot


def account_to_response(db: Session, account: Account, include_summary: bool = False):
    from app.schemas.account import AccountResponse, AccountSummary, AccountTypeBrief

    response = AccountResponse(
        id=account.id,
        account_type_id=account.account_type_id,
        account_type=AccountTypeBrief.model_validate(account.account_type),
        name=account.name,
        institution=account.institution,
        cash_balance=account.cash_balance,
        metadata=parse_metadata(account.metadata_json),
        is_active=account.is_active,
    )
    if include_summary:
        holdings = db.query(Holding).filter(Holding.account_id == account.id, Holding.quantity > 0).all()
        holdings_value = sum((holding_market_value(h) for h in holdings), Decimal("0"))
        response.summary = AccountSummary(
            holdings_count=len(holdings),
            holdings_value=holdings_value,
            total_value=to_decimal(account.cash_balance) + holdings_value,
        )
    return response


def holding_to_response(holding: Holding, account_name: str | None = None):
    from app.schemas.account import HoldingResponse

    accrued_interest = holding_accrued_interest(holding) if is_deposit_holding(holding) else Decimal("0")
    market_value = holding_market_value(holding)
    cost_basis = holding_cost_basis(holding)
    profit_loss = market_value - cost_basis
    profit_loss_rate = (profit_loss / cost_basis * 100) if cost_basis > 0 else Decimal("0")
    return HoldingResponse(
        id=holding.id,
        account_id=holding.account_id,
        account_name=account_name,
        asset_class=holding.asset_class,
        symbol=holding.symbol,
        name=holding.name,
        quantity=holding.quantity,
        avg_cost_price=holding.avg_cost_price,
        manual_price=holding.manual_price,
        last_market_price=holding.last_market_price,
        last_price_updated_at=holding.last_price_updated_at,
        current_price=holding_current_price(holding),
        market_value=market_value,
        cost_basis=cost_basis,
        profit_loss=profit_loss,
        profit_loss_rate=profit_loss_rate.quantize(Decimal("0.01")),
        interest_rate=holding.interest_rate,
        start_date=holding.start_date,
        maturity_date=holding.maturity_date,
        accrued_interest=accrued_interest if is_deposit_holding(holding) else None,
    )


def serialize_account_metadata(data: dict | None) -> str | None:
    return dump_metadata(data)
