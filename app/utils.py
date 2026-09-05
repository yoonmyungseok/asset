import json
import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

ASSET_CLASS_STOCK = "stock"
ASSET_CLASS_DEPOSIT = "deposit"
DAYS_PER_YEAR = Decimal("365")


def parse_metadata(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def dump_metadata(data: dict[str, Any] | None) -> str | None:
    if not data:
        return None
    return json.dumps(data, ensure_ascii=False)


def to_decimal(value: Decimal | float | int | str | None, default: Decimal = Decimal("0")) -> Decimal:
    if value is None:
        return default
    return Decimal(str(value))


def is_deposit_holding(holding) -> bool:
    return getattr(holding, "asset_class", ASSET_CLASS_STOCK) == ASSET_CLASS_DEPOSIT


def generate_deposit_symbol() -> str:
    return f"DEP.{uuid.uuid4().hex[:8].upper()}"


def normalize_deposit_holding(holding) -> None:
    holding.avg_cost_price = Decimal("1")
    holding.manual_price = Decimal("1")


def holding_interest_accrual_end(holding, as_of: date | None = None) -> date:
    as_of = as_of or date.today()
    maturity_date = getattr(holding, "maturity_date", None)
    if maturity_date and maturity_date < as_of:
        return maturity_date
    return as_of


def holding_accrued_interest(holding, as_of: date | None = None) -> Decimal:
    if not is_deposit_holding(holding):
        return Decimal("0")

    rate = getattr(holding, "interest_rate", None)
    start_date = getattr(holding, "start_date", None)
    if rate is None or start_date is None:
        return Decimal("0")

    rate = to_decimal(rate)
    if rate <= 0:
        return Decimal("0")

    principal = to_decimal(holding.quantity)
    if principal <= 0:
        return Decimal("0")

    end_date = holding_interest_accrual_end(holding, as_of)
    days = (end_date - start_date).days
    if days <= 0:
        return Decimal("0")

    accrued = principal * rate / Decimal("100") * Decimal(days) / DAYS_PER_YEAR
    return accrued.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def holding_current_price(holding) -> Decimal:
    if is_deposit_holding(holding):
        return Decimal("1")
    if holding.last_market_price is not None:
        return to_decimal(holding.last_market_price)
    if holding.manual_price is not None:
        return to_decimal(holding.manual_price)
    return to_decimal(holding.avg_cost_price)


def holding_market_value(holding, as_of: date | None = None) -> Decimal:
    if is_deposit_holding(holding):
        return to_decimal(holding.quantity) + holding_accrued_interest(holding, as_of)
    return to_decimal(holding.quantity) * holding_current_price(holding)


def holding_cost_basis(holding) -> Decimal:
    return to_decimal(holding.quantity) * to_decimal(holding.avg_cost_price)
