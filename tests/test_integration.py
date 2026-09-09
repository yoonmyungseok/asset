from datetime import date


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_initialize_idempotent(client):
    r = client.post("/api/v1/setup/initialize")
    assert r.status_code == 201
    data = r.json()
    assert data["account_types"] == 0  # 이미 session fixture에서 초기화됨


def test_institutions(client):
    r = client.get("/api/v1/institutions")
    assert r.status_code == 200
    groups = r.json()
    assert len(groups) >= 3
    assert groups[0]["category"]
    assert groups[0]["label"]
    assert "KB국민은행" in groups[0]["institutions"]


def test_account_crud(client):
    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 7, "name": "테스트 입출금", "institution": "국민", "cash_balance": 1000000},
    )
    assert r.status_code == 201
    account_id = r.json()["id"]

    r = client.get(f"/api/v1/accounts/{account_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "테스트 입출금"

    r = client.patch(f"/api/v1/accounts/{account_id}", json={"cash_balance": 2000000})
    assert r.status_code == 200
    assert float(r.json()["cash_balance"]) == 2000000


def test_ledger_transaction_and_summary(client):
    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 7, "name": "급여 계좌", "cash_balance": 0},
    )
    account_id = r.json()["id"]

    client.post(
        "/api/v1/ledger-transactions",
        json={
            "transaction_date": str(date.today()),
            "type": "expense",
            "amount": 15000,
            "category_id": 2,
            "payment_method_id": 1,
            "merchant": "스타벅스",
        },
    )
    client.post(
        "/api/v1/ledger-transactions",
        json={
            "transaction_date": str(date.today()),
            "type": "income",
            "amount": 3500000,
            "category_id": 20,
            "account_id": account_id,
        },
    )

    today = date.today()
    r = client.get(
        f"/api/v1/ledger-transactions/summary?year={today.year}&month={today.month}&group_by=category"
    )
    assert r.status_code == 200
    data = r.json()
    assert float(data["total_income"]) >= 3500000
    assert float(data["total_expense"]) >= 15000


def test_reimbursement_transactions(client):
    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 7, "name": "회사비용 계좌", "cash_balance": 100000},
    )
    account_id = r.json()["id"]

    r = client.post(
        "/api/v1/ledger-transactions",
        json={
            "transaction_date": str(date.today()),
            "type": "reimbursement_out",
            "amount": 50000,
            "account_id": account_id,
            "merchant": "팀 회의비",
        },
    )
    assert r.status_code == 201
    assert r.json()["type"] == "reimbursement_out"

    account = client.get(f"/api/v1/accounts/{account_id}").json()
    assert float(account["cash_balance"]) == 50000

    r = client.post(
        "/api/v1/ledger-transactions",
        json={
            "transaction_date": str(date.today()),
            "type": "reimbursement_in",
            "amount": 50000,
            "account_id": account_id,
            "merchant": "팀 회의비 환급",
        },
    )
    assert r.status_code == 201

    account = client.get(f"/api/v1/accounts/{account_id}").json()
    assert float(account["cash_balance"]) == 100000

    today = date.today()
    summary = client.get(
        f"/api/v1/ledger-transactions/summary?year={today.year}&month={today.month}&group_by=category"
    ).json()
    assert float(summary["total_income"]) == 0
    assert float(summary["total_expense"]) == 0


def test_investment_holding_and_transaction(client):
    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 1, "name": "테스트 ISA", "cash_balance": 5000000},
    )
    account_id = r.json()["id"]

    r = client.post(
        "/api/v1/holdings",
        json={
            "account_id": account_id,
            "symbol": "005930.KS",
            "name": "삼성전자",
            "quantity": 10,
            "avg_cost_price": 70000,
        },
    )
    assert r.status_code == 201

    r = client.post(
        "/api/v1/investment-transactions",
        json={
            "account_id": account_id,
            "type": "buy",
            "transaction_date": str(date.today()),
            "symbol": "000660.KS",
            "name": "SK하이닉스",
            "quantity": 5,
            "price": 120000,
            "amount": 600000,
            "fee": 1000,
        },
    )
    assert r.status_code == 201

    r = client.get(f"/api/v1/holdings?account_id={account_id}")
    assert r.status_code == 200
    assert len(r.json()) >= 2


def test_dividend_increases_cash_only(client):
    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 1, "name": "배당 테스트 ISA", "cash_balance": 100000},
    )
    account_id = r.json()["id"]

    r = client.post(
        "/api/v1/holdings",
        json={
            "account_id": account_id,
            "symbol": "379780.KS",
            "name": "RISE 미국S&P500",
            "quantity": 68,
            "avg_cost_price": 22900,
        },
    )
    holding_id = r.json()["id"]
    before = client.get(f"/api/v1/holdings?account_id={account_id}").json()
    holding_before = next(item for item in before if item["id"] == holding_id)

    r = client.post(
        "/api/v1/investment-transactions",
        json={
            "account_id": account_id,
            "type": "dividend",
            "transaction_date": str(date.today()),
            "amount": 8085,
            "memo": "분기 배당",
        },
    )
    assert r.status_code == 201
    assert r.json()["holding_id"] is None

    account = client.get(f"/api/v1/accounts/{account_id}").json()
    assert float(account["cash_balance"]) == 108085

    after = client.get(f"/api/v1/holdings?account_id={account_id}").json()
    holding_after = next(item for item in after if item["id"] == holding_id)
    assert holding_after["quantity"] == holding_before["quantity"]
    assert holding_after["avg_cost_price"] == holding_before["avg_cost_price"]
    assert holding_after["current_price"] == holding_before["current_price"]
    assert holding_after["market_value"] == holding_before["market_value"]

    client.delete(f"/api/v1/investment-transactions/{r.json()['id']}")
    account = client.get(f"/api/v1/accounts/{account_id}").json()
    assert float(account["cash_balance"]) == 100000


def test_deposit_holding_in_pension_account(client):
    account_types = client.get("/api/v1/account-types").json()
    dc_type = next(item for item in account_types if item["code"] == "DC_PENSION")

    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": dc_type["id"], "name": "회사 DC", "cash_balance": 20000000},
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
            "maturity_date": "2027-12-31",
        },
    )
    assert r.status_code == 201
    holding = r.json()
    assert holding["asset_class"] == "deposit"
    assert float(holding["interest_rate"]) == 3.5
    assert holding["maturity_date"] == "2027-12-31"
    assert float(holding["market_value"]) == 10000000
    assert float(holding["current_price"]) == 1

    r = client.post(
        "/api/v1/investment-transactions",
        json={
            "account_id": account_id,
            "type": "buy",
            "transaction_date": str(date.today()),
            "asset_class": "deposit",
            "name": "퇴직연금 예금 (3.5%)",
            "amount": 2000000,
            "fee": 0,
        },
    )
    assert r.status_code == 201

    holdings = client.get(f"/api/v1/holdings?account_id={account_id}").json()
    assert len(holdings) == 1
    assert float(holdings[0]["quantity"]) == 12000000

    account = client.get(f"/api/v1/accounts/{account_id}").json()
    assert float(account["cash_balance"]) == 18000000
    assert float(account["summary"]["total_value"]) == 30000000

    r = client.post(
        "/api/v1/investment-transactions",
        json={
            "account_id": account_id,
            "type": "interest",
            "transaction_date": str(date.today()),
            "holding_id": holdings[0]["id"],
            "amount": 50000,
            "memo": "분기 이자",
        },
    )
    assert r.status_code == 201

    holdings = client.get(f"/api/v1/holdings?account_id={account_id}").json()
    assert float(holdings[0]["quantity"]) == 12050000
    assert float(client.get(f"/api/v1/accounts/{account_id}").json()["cash_balance"]) == 18000000


def test_zero_quantity_holdings_are_hidden(client):
    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 1, "name": "매도 완료 ISA", "cash_balance": 0},
    )
    account_id = r.json()["id"]

    r = client.post(
        "/api/v1/holdings",
        json={
            "account_id": account_id,
            "symbol": "329200.KS",
            "name": "TIGER 리츠부동산인프라",
            "quantity": 0,
            "avg_cost_price": 0,
        },
    )
    assert r.status_code == 201

    holdings = client.get(f"/api/v1/holdings?account_id={account_id}").json()
    assert holdings == []

    account = client.get(f"/api/v1/accounts/{account_id}").json()
    assert account["summary"]["holdings_count"] == 0


def test_budget_and_alerts(client):
    today = date.today()
    r = client.put(
        "/api/v1/budgets",
        json={"category_id": 1, "year": today.year, "month": today.month, "amount": 10000},
    )
    assert r.status_code == 200

    client.post(
        "/api/v1/ledger-transactions",
        json={
            "transaction_date": str(date.today()),
            "type": "expense",
            "amount": 50000,
            "category_id": 2,
            "payment_method_id": 1,
        },
    )

    r = client.get(f"/api/v1/budgets/alerts?year={today.year}&month={today.month}")
    assert r.status_code == 200
    data = r.json()
    assert len(data["over_budget"]) >= 1


def test_liability_and_dashboard(client):
    client.post(
        "/api/v1/liabilities",
        json={"type": "loan", "name": "테스트 대출", "current_balance": 100000000},
    )

    r = client.get("/api/v1/dashboard/overview")
    assert r.status_code == 200
    data = r.json()
    assert float(data["net_worth"]["total_liabilities"]) >= 100000000
    assert "cashflow" in data
    assert "accounts_summary" in data


def test_account_limit(client):
    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 1, "name": "한도 ISA", "cash_balance": 0},
    )
    account_id = r.json()["id"]

    r = client.put(
        "/api/v1/account-limits",
        json={"account_id": account_id, "year": date.today().year, "contribution_limit": 20000000},
    )
    assert r.status_code == 200
    assert float(r.json()["contribution_limit"]) == 20000000

    client.post(
        "/api/v1/investment-transactions",
        json={
            "account_id": account_id,
            "type": "deposit",
            "transaction_date": str(date.today()),
            "amount": 5000000,
        },
    )

    r = client.get(f"/api/v1/account-limits?account_id={account_id}")
    assert float(r.json()[0]["contributed_amount"]) >= 5000000

    limit_id = r.json()[0]["id"]
    r = client.delete(f"/api/v1/account-limits/{limit_id}")
    assert r.status_code == 204

    r = client.get(f"/api/v1/account-limits?account_id={account_id}")
    assert r.json() == []


def test_inactive_account_limit_hidden_from_dashboard(client):
    r = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 1, "name": "비활성 ISA", "cash_balance": 0},
    )
    account_id = r.json()["id"]
    client.put(
        "/api/v1/account-limits",
        json={"account_id": account_id, "year": date.today().year, "contribution_limit": 20000000},
    )
    client.post(f"/api/v1/accounts/{account_id}/deactivate")

    r = client.get("/api/v1/dashboard/overview")
    names = [a["account_name"] for a in r.json()["limit_alerts"]]
    assert "비활성 ISA" not in names


def test_recurring_generate(client):
    client.post(
        "/api/v1/recurring-items",
        json={
            "type": "income",
            "amount": 3500000,
            "category_id": 20,
            "payment_method_id": 3,
            "merchant": "급여",
            "day_of_month": 25,
        },
    )
    today = date.today()
    r = client.post(
        "/api/v1/recurring-items/generate",
        json={"year": today.year, "month": today.month},
    )
    assert r.status_code == 200
    assert r.json()["generated"] >= 1

    r2 = client.post(
        "/api/v1/recurring-items/generate",
        json={"year": today.year, "month": today.month},
    )
    assert r2.json()["skipped"] >= 1


def test_snapshot_and_refresh(client):
    r = client.post("/api/v1/snapshots/daily")
    assert r.status_code == 201

    r = client.post("/api/v1/dashboard/refresh")
    assert r.status_code == 200
    assert r.json()["snapshot_saved"] is True

    r = client.get("/api/v1/dashboard/net-worth-trend")
    assert r.status_code == 200
    assert len(r.json()["data"]) >= 1


def test_backup_download(client):
    r = client.get("/api/v1/backup")
    assert r.status_code == 200
    assert len(r.content) > 0


def test_categories_tree(client):
    r = client.get("/api/v1/categories?include_children=true")
    assert r.status_code == 200
    trees = r.json()
    assert len(trees) >= 7
    assert all("children" in c for c in trees)


def test_tags_on_ledger(client):
    r = client.post(
        "/api/v1/ledger-transactions",
        json={
            "transaction_date": str(date.today()),
            "type": "expense",
            "amount": 10000,
            "category_id": 2,
            "tag_names": ["테스트태그"],
        },
    )
    assert r.status_code == 201
    assert "테스트태그" in r.json()["tags"]

    r = client.get("/api/v1/tags")
    assert any(t["name"] == "테스트태그" for t in r.json())


def test_ledger_summary_by_card(client):
    account = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 8, "name": "카드요약 계좌", "cash_balance": 500000},
    ).json()
    debit_card = client.post(
        "/api/v1/cards",
        json={
            "name": "체크카드 A",
            "card_type": "debit",
            "linked_account_id": account["id"],
        },
    ).json()
    credit_card = client.post(
        "/api/v1/cards",
        json={
            "name": "신용카드 B",
            "card_type": "credit",
            "settlement_account_id": account["id"],
            "due_day": 15,
        },
    ).json()
    today = date.today()
    for card_id, amount in [(debit_card["id"], 20000), (credit_card["id"], 30000)]:
        client.post(
            "/api/v1/ledger-transactions",
            json={
                "transaction_date": str(today),
                "type": "expense",
                "amount": amount,
                "category_id": 2,
                "payment_method_id": 2,
                "card_id": card_id,
            },
        )
    r = client.get(
        f"/api/v1/ledger-transactions/summary?year={today.year}&month={today.month}&group_by=category"
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["by_card"]) == 2
    assert data["by_card"][0]["card_name"] == "신용카드 B"
    assert float(data["by_card"][0]["amount"]) == 30000
    assert data["by_card"][1]["card_name"] == "체크카드 A"
    assert float(data["by_card"][1]["amount"]) == 20000


def test_debit_card_expense_deducts_account(client):
    account = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 8, "name": "KB 입출금", "institution": "KB국민은행", "cash_balance": 100000},
    ).json()
    card = client.post(
        "/api/v1/cards",
        json={
            "name": "KB국민 체크카드",
            "card_type": "debit",
            "institution": "KB국민은행",
            "linked_account_id": account["id"],
        },
    ).json()
    r = client.post(
        "/api/v1/ledger-transactions",
        json={
            "transaction_date": str(date.today()),
            "type": "expense",
            "amount": 15000,
            "category_id": 2,
            "payment_method_id": 2,
            "card_id": card["id"],
            "merchant": "편의점",
        },
    )
    assert r.status_code == 201
    updated = client.get(f"/api/v1/accounts/{account['id']}").json()
    assert float(updated["cash_balance"]) == 85000


def test_credit_card_expense_increases_liability(client):
    account = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 8, "name": "결제 계좌", "cash_balance": 500000},
    ).json()
    card = client.post(
        "/api/v1/cards",
        json={
            "name": "KB국민 신용카드",
            "card_type": "credit",
            "institution": "KB국민은행",
            "settlement_account_id": account["id"],
            "due_day": 10,
        },
    ).json()
    client.post(
        "/api/v1/ledger-transactions",
        json={
            "transaction_date": str(date.today()),
            "type": "expense",
            "amount": 30000,
            "category_id": 2,
            "payment_method_id": 2,
            "card_id": card["id"],
            "merchant": "마트",
        },
    )
    liabilities = client.get("/api/v1/liabilities").json()
    credit = next(l for l in liabilities if l["name"] == "KB국민 신용카드")
    assert float(credit["current_balance"]) == 30000


def test_card_update(client):
    account = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 8, "name": "수정용 계좌", "cash_balance": 100000},
    ).json()
    card = client.post(
        "/api/v1/cards",
        json={
            "name": "수정 전 카드",
            "card_type": "debit",
            "linked_account_id": account["id"],
        },
    ).json()
    r = client.patch(
        f"/api/v1/cards/{card['id']}",
        json={"name": "수정 후 카드"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "수정 후 카드"


def test_credit_card_auto_settlement(client):
    account = client.post(
        "/api/v1/accounts",
        json={"account_type_id": 8, "name": "자동결제 계좌", "cash_balance": 200000},
    ).json()
    card = client.post(
        "/api/v1/cards",
        json={
            "name": "삼성카드",
            "card_type": "credit",
            "settlement_account_id": account["id"],
            "due_day": 1,
        },
    ).json()
    client.post(
        "/api/v1/ledger-transactions",
        json={
            "transaction_date": str(date.today()),
            "type": "expense",
            "amount": 50000,
            "category_id": 2,
            "payment_method_id": 2,
            "card_id": card["id"],
        },
    )
    today = date.today()
    r = client.post(f"/api/v1/cards/process-settlements?as_of={today.isoformat()}")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert float(r.json()[0]["amount"]) == 50000
    updated = client.get(f"/api/v1/accounts/{account['id']}").json()
    assert float(updated["cash_balance"]) == 150000
    liabilities = client.get("/api/v1/liabilities").json()
    credit = next(l for l in liabilities if l["name"] == "삼성카드")
    assert float(credit["current_balance"]) == 0

