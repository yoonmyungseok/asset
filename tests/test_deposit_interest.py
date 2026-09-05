from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from app.utils import holding_accrued_interest, holding_market_value


def _deposit(principal: str, rate: str, start: str, maturity: str | None = None):
    return SimpleNamespace(
        asset_class="deposit",
        quantity=Decimal(principal),
        interest_rate=Decimal(rate),
        start_date=date.fromisoformat(start),
        maturity_date=date.fromisoformat(maturity) if maturity else None,
    )


def test_no_interest_without_rate_or_start_date():
    holding = _deposit("10000000", "3.5", "2025-01-01")
    holding.interest_rate = None
    assert holding_accrued_interest(holding, date(2025, 7, 1)) == Decimal("0")

    holding.interest_rate = Decimal("3.5")
    holding.start_date = None
    assert holding_accrued_interest(holding, date(2025, 7, 1)) == Decimal("0")


def test_simple_interest_for_365_days():
    holding = _deposit("10000000", "3.5", "2023-01-01")
    accrued = holding_accrued_interest(holding, date(2024, 1, 1))
    assert accrued == Decimal("350000.00")
    assert holding_market_value(holding, date(2024, 1, 1)) == Decimal("10350000.00")


def test_interest_stops_at_maturity_date():
    holding = _deposit("10000000", "3.5", "2024-01-01", "2024-07-01")
    accrued_at_maturity = holding_accrued_interest(holding, date(2024, 7, 1))
    accrued_after_maturity = holding_accrued_interest(holding, date(2025, 1, 1))
    days = (date(2024, 7, 1) - date(2024, 1, 1)).days
    expected = (Decimal("10000000") * Decimal("3.5") / Decimal("100") * Decimal(days) / Decimal("365")).quantize(Decimal("0.01"))
    assert accrued_at_maturity == expected
    assert accrued_after_maturity == accrued_at_maturity


def test_same_day_start_has_zero_interest():
    holding = _deposit("10000000", "3.5", "2025-01-01")
    assert holding_accrued_interest(holding, date(2025, 1, 1)) == Decimal("0")


def test_deposit_holding_api_includes_accrued_interest(client):
    account_types = client.get("/api/v1/account-types").json()
    dc_type = next(item for item in account_types if item["code"] == "DC_PENSION")

    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": dc_type["id"], "name": "이자 테스트 DC", "cash_balance": 0},
    )
    account_id = r.json()["id"]

    r = client.post(
        "/api/v1/holdings",
        json={
            "account_id": account_id,
            "asset_class": "deposit",
            "name": "퇴직연금 예금 (3.5%)",
            "quantity": 10000000,
            "interest_rate": 3.5,
            "start_date": "2024-01-01",
            "maturity_date": "2027-12-31",
        },
    )
    assert r.status_code == 201
    holding = r.json()
    assert float(holding["quantity"]) == 10000000
    assert float(holding["accrued_interest"]) > 0
    assert float(holding["market_value"]) > float(holding["quantity"])
    assert float(holding["profit_loss"]) == float(holding["accrued_interest"])


def test_interest_transaction_resets_accrual_start_date(client):
    account_types = client.get("/api/v1/account-types").json()
    dc_type = next(item for item in account_types if item["code"] == "DC_PENSION")

    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": dc_type["id"], "name": "이자 정산 DC", "cash_balance": 0},
    )
    account_id = r.json()["id"]

    r = client.post(
        "/api/v1/holdings",
        json={
            "account_id": account_id,
            "asset_class": "deposit",
            "name": "정기예금",
            "quantity": 10000000,
            "interest_rate": 3.5,
            "start_date": "2024-01-01",
        },
    )
    holding_id = r.json()["id"]
    before_interest = client.get(f"/api/v1/holdings?account_id={account_id}").json()[0]
    accrued_before = float(before_interest["accrued_interest"])

    r = client.post(
        "/api/v1/investment-transactions",
        json={
            "account_id": account_id,
            "type": "interest",
            "transaction_date": str(date.today()),
            "holding_id": holding_id,
            "amount": 50000,
            "memo": "분기 이자",
        },
    )
    assert r.status_code == 201

    after_interest = client.get(f"/api/v1/holdings?account_id={account_id}").json()[0]
    assert float(after_interest["quantity"]) == 10050000
    assert float(after_interest["accrued_interest"]) < accrued_before
    assert after_interest["start_date"] == str(date.today())
