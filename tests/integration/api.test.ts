/**
 * @vitest-environment node
 */
import { format } from "date-fns";
import { describe, expect, it } from "vitest";

import { apiClient } from "../helpers/api-client";
import {
  getAccountTypeId,
  getCategoryId,
  getPaymentMethodId,
} from "../helpers/seed-ids";

const today = format(new Date(), "yyyy-MM-dd");
const todayDate = new Date();
const year = todayDate.getFullYear();
const month = todayDate.getMonth() + 1;

describe("API integration", () => {
  it("test_health", async () => {
    const r = await apiClient.get("/api/v1/health");
    expect(r.status).toBe(200);
    const data = await r.json<{ status: string }>();
    expect(data.status).toBe("ok");
  });

  it("test_initialize_idempotent", async () => {
    const r = await apiClient.post("/api/v1/setup/initialize");
    expect(r.status).toBe(201);
    const data = await r.json<{ account_types: number }>();
    expect(data.account_types).toBe(0);
  });

  it("test_institutions", async () => {
    const r = await apiClient.get("/api/v1/institutions");
    expect(r.status).toBe(200);
    const groups = await r.json<Array<{ category: string; label: string; institutions: string[] }>>();
    expect(groups.length).toBeGreaterThanOrEqual(3);
    expect(groups[0].category).toBeTruthy();
    expect(groups[0].label).toBeTruthy();
    expect(groups[0].institutions).toContain("KB국민은행");
  });

  it("test_account_crud", async () => {
    const depositTypeId = await getAccountTypeId("DEPOSIT");

    const create = await apiClient.post("/api/v1/accounts", {
      json: {
        account_type_id: depositTypeId,
        name: "테스트 입출금",
        institution: "국민",
        cash_balance: 1000000,
      },
    });
    expect(create.status).toBe(201);
    const { id: accountId } = await create.json<{ id: number }>();

    const get = await apiClient.get(`/api/v1/accounts/${accountId}`);
    expect(get.status).toBe(200);
    const account = await get.json<{ name: string }>();
    expect(account.name).toBe("테스트 입출금");

    const patch = await apiClient.patch(`/api/v1/accounts/${accountId}`, {
      json: { cash_balance: 2000000 },
    });
    expect(patch.status).toBe(200);
    const updated = await patch.json<{ cash_balance: string }>();
    expect(Number(updated.cash_balance)).toBe(2000000);
  });

  it("test_ledger_transaction_and_summary", async () => {
    const depositTypeId = await getAccountTypeId("DEPOSIT");
    const expenseCategoryId = await getCategoryId("외식", "식비");
    const incomeCategoryId = await getCategoryId("본봉", "급여");
    const cashPaymentId = await getPaymentMethodId("현금");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: depositTypeId, name: "급여 계좌", cash_balance: 0 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    await apiClient.post("/api/v1/ledger-transactions", {
      json: {
        transaction_date: today,
        type: "expense",
        amount: 15000,
        category_id: expenseCategoryId,
        payment_method_id: cashPaymentId,
        merchant: "스타벅스",
      },
    });
    await apiClient.post("/api/v1/ledger-transactions", {
      json: {
        transaction_date: today,
        type: "income",
        amount: 3500000,
        category_id: incomeCategoryId,
        account_id: accountId,
      },
    });

    const summary = await apiClient.get(
      `/api/v1/ledger-transactions/summary?year=${year}&month=${month}&group_by=category`,
    );
    expect(summary.status).toBe(200);
    const data = await summary.json<{ total_income: string; total_expense: string }>();
    expect(Number(data.total_income)).toBeGreaterThanOrEqual(3500000);
    expect(Number(data.total_expense)).toBeGreaterThanOrEqual(15000);
  });

  it("test_reimbursement_transactions", async () => {
    const depositTypeId = await getAccountTypeId("DEPOSIT");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: {
        account_type_id: depositTypeId,
        name: "회사비용 계좌",
        cash_balance: 100000,
      },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    const outRes = await apiClient.post("/api/v1/ledger-transactions", {
      json: {
        transaction_date: today,
        type: "reimbursement_out",
        amount: 50000,
        account_id: accountId,
        merchant: "팀 회의비",
      },
    });
    expect(outRes.status).toBe(201);
    const outTx = await outRes.json<{ type: string }>();
    expect(outTx.type).toBe("reimbursement_out");

    let account = await (await apiClient.get(`/api/v1/accounts/${accountId}`)).json<{
      cash_balance: string;
    }>();
    expect(Number(account.cash_balance)).toBe(50000);

    const inRes = await apiClient.post("/api/v1/ledger-transactions", {
      json: {
        transaction_date: today,
        type: "reimbursement_in",
        amount: 50000,
        account_id: accountId,
        merchant: "팀 회의비 환급",
      },
    });
    expect(inRes.status).toBe(201);

    account = await (await apiClient.get(`/api/v1/accounts/${accountId}`)).json<{
      cash_balance: string;
    }>();
    expect(Number(account.cash_balance)).toBe(100000);

    const summary = await (
      await apiClient.get(
        `/api/v1/ledger-transactions/summary?year=${year}&month=${month}&group_by=category`,
      )
    ).json<{ total_income: string; total_expense: string }>();
    expect(Number(summary.total_income)).toBe(0);
    expect(Number(summary.total_expense)).toBe(0);
  });

  it("test_investment_holding_and_transaction", async () => {
    const isaTypeId = await getAccountTypeId("ISA");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: isaTypeId, name: "테스트 ISA", cash_balance: 5000000 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    const holdingRes = await apiClient.post("/api/v1/holdings", {
      json: {
        account_id: accountId,
        symbol: "005930.KS",
        name: "삼성전자",
        quantity: 10,
        avg_cost_price: 70000,
      },
    });
    expect(holdingRes.status).toBe(201);

    const txRes = await apiClient.post("/api/v1/investment-transactions", {
      json: {
        account_id: accountId,
        type: "buy",
        transaction_date: today,
        symbol: "000660.KS",
        name: "SK하이닉스",
        quantity: 5,
        price: 120000,
        amount: 600000,
        fee: 1000,
      },
    });
    expect(txRes.status).toBe(201);

    const holdingsRes = await apiClient.get(`/api/v1/holdings?account_id=${accountId}`);
    expect(holdingsRes.status).toBe(200);
    const holdings = await holdingsRes.json<unknown[]>();
    expect(holdings.length).toBeGreaterThanOrEqual(2);
  });

  it("test_dividend_increases_cash_only", async () => {
    const isaTypeId = await getAccountTypeId("ISA");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: isaTypeId, name: "배당 테스트 ISA", cash_balance: 100000 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    const holdingRes = await apiClient.post("/api/v1/holdings", {
      json: {
        account_id: accountId,
        symbol: "379780.KS",
        name: "RISE 미국S&P500",
        quantity: 68,
        avg_cost_price: 22900,
      },
    });
    const { id: holdingId } = await holdingRes.json<{ id: number }>();

    const before = await (
      await apiClient.get(`/api/v1/holdings?account_id=${accountId}`)
    ).json<
      Array<{
        id: number;
        quantity: string;
        avg_cost_price: string;
        current_price: string | null;
        market_value: string;
      }>
    >();
    const holdingBefore = before.find((item) => item.id === holdingId)!;

    const dividendRes = await apiClient.post("/api/v1/investment-transactions", {
      json: {
        account_id: accountId,
        type: "dividend",
        transaction_date: today,
        amount: 8085,
        memo: "분기 배당",
      },
    });
    expect(dividendRes.status).toBe(201);
    const dividendTx = await dividendRes.json<{ id: number; holding_id: number | null }>();
    expect(dividendTx.holding_id).toBeNull();

    let account = await (await apiClient.get(`/api/v1/accounts/${accountId}`)).json<{
      cash_balance: string;
    }>();
    expect(Number(account.cash_balance)).toBe(108085);

    const after = await (
      await apiClient.get(`/api/v1/holdings?account_id=${accountId}`)
    ).json<
      Array<{
        id: number;
        quantity: string;
        avg_cost_price: string;
        current_price: string | null;
        market_value: string;
      }>
    >();
    const holdingAfter = after.find((item) => item.id === holdingId)!;
    expect(holdingAfter.quantity).toBe(holdingBefore.quantity);
    expect(holdingAfter.avg_cost_price).toBe(holdingBefore.avg_cost_price);
    expect(holdingAfter.current_price).toBe(holdingBefore.current_price);
    expect(holdingAfter.market_value).toBe(holdingBefore.market_value);

    await apiClient.delete(`/api/v1/investment-transactions/${dividendTx.id}`);
    account = await (await apiClient.get(`/api/v1/accounts/${accountId}`)).json<{
      cash_balance: string;
    }>();
    expect(Number(account.cash_balance)).toBe(100000);
  });

  it("test_deposit_holding_in_pension_account", async () => {
    const dcTypeId = await getAccountTypeId("DC_PENSION");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: dcTypeId, name: "회사 DC", cash_balance: 20000000 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    const holdingRes = await apiClient.post("/api/v1/holdings", {
      json: {
        account_id: accountId,
        asset_class: "deposit",
        name: "퇴직연금 예금 (3.5%)",
        quantity: 10000000,
        interest_rate: 3.5,
        maturity_date: "2027-12-31",
      },
    });
    expect(holdingRes.status).toBe(201);
    const holding = await holdingRes.json<{
      asset_class: string;
      interest_rate: string;
      maturity_date: string;
      market_value: string;
      current_price: string;
    }>();
    expect(holding.asset_class).toBe("deposit");
    expect(Number(holding.interest_rate)).toBe(3.5);
    expect(holding.maturity_date).toBe("2027-12-31");
    expect(Number(holding.market_value)).toBe(10000000);
    expect(Number(holding.current_price)).toBe(1);

    const buyRes = await apiClient.post("/api/v1/investment-transactions", {
      json: {
        account_id: accountId,
        type: "buy",
        transaction_date: today,
        asset_class: "deposit",
        name: "퇴직연금 예금 (3.5%)",
        amount: 2000000,
        fee: 0,
      },
    });
    expect(buyRes.status).toBe(201);

    let holdings = await (
      await apiClient.get(`/api/v1/holdings?account_id=${accountId}`)
    ).json<Array<{ quantity: string }>>();
    expect(holdings).toHaveLength(1);
    expect(Number(holdings[0].quantity)).toBe(12000000);

    let account = await (await apiClient.get(`/api/v1/accounts/${accountId}`)).json<{
      cash_balance: string;
      summary: { total_value: string };
    }>();
    expect(Number(account.cash_balance)).toBe(18000000);
    expect(Number(account.summary.total_value)).toBe(30000000);

    const interestRes = await apiClient.post("/api/v1/investment-transactions", {
      json: {
        account_id: accountId,
        type: "interest",
        transaction_date: today,
        holding_id: (
          await (
            await apiClient.get(`/api/v1/holdings?account_id=${accountId}`)
          ).json<Array<{ id: number }>>()
        )[0].id,
        amount: 50000,
        memo: "분기 이자",
      },
    });
    expect(interestRes.status).toBe(201);

    holdings = await (
      await apiClient.get(`/api/v1/holdings?account_id=${accountId}`)
    ).json<Array<{ quantity: string }>>();
    expect(Number(holdings[0].quantity)).toBe(12050000);
    account = await (await apiClient.get(`/api/v1/accounts/${accountId}`)).json<{
      cash_balance: string;
    }>();
    expect(Number(account.cash_balance)).toBe(18000000);
  });

  it("test_zero_quantity_holdings_are_hidden", async () => {
    const isaTypeId = await getAccountTypeId("ISA");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: isaTypeId, name: "매도 완료 ISA", cash_balance: 0 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    const holdingRes = await apiClient.post("/api/v1/holdings", {
      json: {
        account_id: accountId,
        symbol: "329200.KS",
        name: "TIGER 리츠부동산인프라",
        quantity: 0,
        avg_cost_price: 0,
      },
    });
    expect(holdingRes.status).toBe(201);

    const holdings = await (
      await apiClient.get(`/api/v1/holdings?account_id=${accountId}`)
    ).json<unknown[]>();
    expect(holdings).toEqual([]);

    const account = await (await apiClient.get(`/api/v1/accounts/${accountId}`)).json<{
      summary: { holdings_count: number };
    }>();
    expect(account.summary.holdings_count).toBe(0);
  });

  it("test_budget_and_alerts", async () => {
    const foodCategoryId = await getCategoryId("식비");
    const expenseCategoryId = await getCategoryId("외식", "식비");
    const cashPaymentId = await getPaymentMethodId("현금");

    const budgetRes = await apiClient.put("/api/v1/budgets", {
      json: { category_id: foodCategoryId, year, month, amount: 10000 },
    });
    expect(budgetRes.status).toBe(200);

    await apiClient.post("/api/v1/ledger-transactions", {
      json: {
        transaction_date: today,
        type: "expense",
        amount: 50000,
        category_id: expenseCategoryId,
        payment_method_id: cashPaymentId,
      },
    });

    const alertsRes = await apiClient.get(`/api/v1/budgets/alerts?year=${year}&month=${month}`);
    expect(alertsRes.status).toBe(200);
    const data = await alertsRes.json<{ over_budget: unknown[] }>();
    expect(data.over_budget.length).toBeGreaterThanOrEqual(1);
  });

  it("test_liability_and_dashboard", async () => {
    await apiClient.post("/api/v1/liabilities", {
      json: { type: "loan", name: "테스트 대출", current_balance: 100000000 },
    });

    const overviewRes = await apiClient.get("/api/v1/dashboard/overview");
    expect(overviewRes.status).toBe(200);
    const data = await overviewRes.json<{
      net_worth: { total_liabilities: string };
      cashflow: unknown;
      accounts_summary: unknown;
    }>();
    expect(Number(data.net_worth.total_liabilities)).toBeGreaterThanOrEqual(100000000);
    expect(data.cashflow).toBeTruthy();
    expect(data.accounts_summary).toBeTruthy();
  });

  it("test_account_limit", async () => {
    const isaTypeId = await getAccountTypeId("ISA");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: isaTypeId, name: "한도 ISA", cash_balance: 0 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    const limitRes = await apiClient.put("/api/v1/account-limits", {
      json: {
        account_id: accountId,
        year,
        contribution_limit: 20000000,
      },
    });
    expect(limitRes.status).toBe(200);
    const limit = await limitRes.json<{ contribution_limit: string }>();
    expect(Number(limit.contribution_limit)).toBe(20000000);

    await apiClient.post("/api/v1/investment-transactions", {
      json: {
        account_id: accountId,
        type: "deposit",
        transaction_date: today,
        amount: 5000000,
      },
    });

    const limitsRes = await apiClient.get(`/api/v1/account-limits?account_id=${accountId}`);
    const limits = await limitsRes.json<Array<{ id: number; contributed_amount: string }>>();
    expect(Number(limits[0].contributed_amount)).toBeGreaterThanOrEqual(5000000);

    const limitId = limits[0].id;
    const deleteRes = await apiClient.delete(`/api/v1/account-limits/${limitId}`);
    expect(deleteRes.status).toBe(204);

    const emptyLimits = await (
      await apiClient.get(`/api/v1/account-limits?account_id=${accountId}`)
    ).json<unknown[]>();
    expect(emptyLimits).toEqual([]);
  });

  it("test_inactive_account_limit_hidden_from_dashboard", async () => {
    const isaTypeId = await getAccountTypeId("ISA");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: isaTypeId, name: "비활성 ISA", cash_balance: 0 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    await apiClient.put("/api/v1/account-limits", {
      json: { account_id: accountId, year, contribution_limit: 20000000 },
    });
    await apiClient.post(`/api/v1/accounts/${accountId}/deactivate`);

    const overview = await (
      await apiClient.get("/api/v1/dashboard/overview")
    ).json<{ limit_alerts: Array<{ account_name: string }> }>();
    const names = overview.limit_alerts.map((item) => item.account_name);
    expect(names).not.toContain("비활성 ISA");
  });

  it("test_recurring_generate", async () => {
    const incomeCategoryId = await getCategoryId("본봉", "급여");
    const transferPaymentId = await getPaymentMethodId("계좌이체");

    await apiClient.post("/api/v1/recurring-items", {
      json: {
        type: "income",
        amount: 3500000,
        category_id: incomeCategoryId,
        payment_method_id: transferPaymentId,
        merchant: "급여",
        day_of_month: 25,
      },
    });

    const first = await apiClient.post("/api/v1/recurring-items/generate", {
      json: { year, month },
    });
    expect(first.status).toBe(200);
    const firstData = await first.json<{ generated: number }>();
    expect(firstData.generated).toBeGreaterThanOrEqual(1);

    const second = await apiClient.post("/api/v1/recurring-items/generate", {
      json: { year, month },
    });
    const secondData = await second.json<{ skipped: number }>();
    expect(secondData.skipped).toBeGreaterThanOrEqual(1);
  });

  it("test_snapshot_and_refresh", async () => {
    const snapshotRes = await apiClient.post("/api/v1/snapshots/daily");
    expect(snapshotRes.status).toBe(201);

    const refreshRes = await apiClient.post("/api/v1/dashboard/refresh");
    expect(refreshRes.status).toBe(200);
    const refreshData = await refreshRes.json<{ snapshot_saved: boolean }>();
    expect(refreshData.snapshot_saved).toBe(true);

    const trendRes = await apiClient.get("/api/v1/dashboard/net-worth-trend");
    expect(trendRes.status).toBe(200);
    const trend = await trendRes.json<{ data: unknown[] }>();
    expect(trend.data.length).toBeGreaterThanOrEqual(1);
  });

  it("test_backup_download", async () => {
    const r = await apiClient.get("/api/v1/backup");
    expect(r.status).toBe(200);
    expect(r.content.length).toBeGreaterThan(0);
  });

  it("test_categories_tree", async () => {
    const r = await apiClient.get("/api/v1/categories?include_children=true");
    expect(r.status).toBe(200);
    const trees = await r.json<Array<{ children: unknown[] }>>();
    expect(trees.length).toBeGreaterThanOrEqual(7);
    expect(trees.every((category) => "children" in category)).toBe(true);
  });

  it("test_tags_on_ledger", async () => {
    const expenseCategoryId = await getCategoryId("외식", "식비");

    const txRes = await apiClient.post("/api/v1/ledger-transactions", {
      json: {
        transaction_date: today,
        type: "expense",
        amount: 10000,
        category_id: expenseCategoryId,
        tag_names: ["테스트태그"],
      },
    });
    expect(txRes.status).toBe(201);
    const tx = await txRes.json<{ tags: string[] }>();
    expect(tx.tags).toContain("테스트태그");

    const tags = await (await apiClient.get("/api/v1/tags")).json<Array<{ name: string }>>();
    expect(tags.some((tag) => tag.name === "테스트태그")).toBe(true);
  });

  it("test_ledger_summary_by_card", async () => {
    const checkingTypeId = await getAccountTypeId("CHECKING");
    const expenseCategoryId = await getCategoryId("외식", "식비");
    const cardPaymentId = await getPaymentMethodId("카드");

    const account = await (
      await apiClient.post("/api/v1/accounts", {
        json: {
          account_type_id: checkingTypeId,
          name: "카드요약 계좌",
          cash_balance: 500000,
        },
      })
    ).json<{ id: number }>();

    const debitCard = await (
      await apiClient.post("/api/v1/cards", {
        json: {
          name: "체크카드 A",
          card_type: "debit",
          linked_account_id: account.id,
        },
      })
    ).json<{ id: number }>();

    const creditCard = await (
      await apiClient.post("/api/v1/cards", {
        json: {
          name: "신용카드 B",
          card_type: "credit",
          settlement_account_id: account.id,
          due_day: 15,
        },
      })
    ).json<{ id: number }>();

    for (const [cardId, amount] of [
      [debitCard.id, 20000],
      [creditCard.id, 30000],
    ] as const) {
      await apiClient.post("/api/v1/ledger-transactions", {
        json: {
          transaction_date: today,
          type: "expense",
          amount,
          category_id: expenseCategoryId,
          payment_method_id: cardPaymentId,
          card_id: cardId,
        },
      });
    }

    const summary = await apiClient.get(
      `/api/v1/ledger-transactions/summary?year=${year}&month=${month}&group_by=category`,
    );
    expect(summary.status).toBe(200);
    const data = await summary.json<{
      by_card: Array<{ card_name: string; amount: string }>;
    }>();
    expect(data.by_card).toHaveLength(2);
    expect(data.by_card[0].card_name).toBe("신용카드 B");
    expect(Number(data.by_card[0].amount)).toBe(30000);
    expect(data.by_card[1].card_name).toBe("체크카드 A");
    expect(Number(data.by_card[1].amount)).toBe(20000);
  });

  it("test_debit_card_expense_deducts_account", async () => {
    const checkingTypeId = await getAccountTypeId("CHECKING");
    const expenseCategoryId = await getCategoryId("외식", "식비");
    const cardPaymentId = await getPaymentMethodId("카드");

    const account = await (
      await apiClient.post("/api/v1/accounts", {
        json: {
          account_type_id: checkingTypeId,
          name: "KB 입출금",
          institution: "KB국민은행",
          cash_balance: 100000,
        },
      })
    ).json<{ id: number }>();

    const card = await (
      await apiClient.post("/api/v1/cards", {
        json: {
          name: "KB국민 체크카드",
          card_type: "debit",
          institution: "KB국민은행",
          linked_account_id: account.id,
        },
      })
    ).json<{ id: number }>();

    const txRes = await apiClient.post("/api/v1/ledger-transactions", {
      json: {
        transaction_date: today,
        type: "expense",
        amount: 15000,
        category_id: expenseCategoryId,
        payment_method_id: cardPaymentId,
        card_id: card.id,
        merchant: "편의점",
      },
    });
    expect(txRes.status).toBe(201);

    const updated = await (
      await apiClient.get(`/api/v1/accounts/${account.id}`)
    ).json<{ cash_balance: string }>();
    expect(Number(updated.cash_balance)).toBe(85000);
  });

  it("test_credit_card_expense_increases_liability", async () => {
    const checkingTypeId = await getAccountTypeId("CHECKING");
    const expenseCategoryId = await getCategoryId("외식", "식비");
    const cardPaymentId = await getPaymentMethodId("카드");

    const account = await (
      await apiClient.post("/api/v1/accounts", {
        json: {
          account_type_id: checkingTypeId,
          name: "결제 계좌",
          cash_balance: 500000,
        },
      })
    ).json<{ id: number }>();

    const card = await (
      await apiClient.post("/api/v1/cards", {
        json: {
          name: "KB국민 신용카드",
          card_type: "credit",
          institution: "KB국민은행",
          settlement_account_id: account.id,
          due_day: 10,
        },
      })
    ).json<{ id: number }>();

    await apiClient.post("/api/v1/ledger-transactions", {
      json: {
        transaction_date: today,
        type: "expense",
        amount: 30000,
        category_id: expenseCategoryId,
        payment_method_id: cardPaymentId,
        card_id: card.id,
        merchant: "마트",
      },
    });

    const liabilities = await (
      await apiClient.get("/api/v1/liabilities")
    ).json<Array<{ name: string; current_balance: string }>>();
    const credit = liabilities.find((item) => item.name === "KB국민 신용카드")!;
    expect(Number(credit.current_balance)).toBe(30000);
  });

  it("test_card_update", async () => {
    const checkingTypeId = await getAccountTypeId("CHECKING");

    const account = await (
      await apiClient.post("/api/v1/accounts", {
        json: {
          account_type_id: checkingTypeId,
          name: "수정용 계좌",
          cash_balance: 100000,
        },
      })
    ).json<{ id: number }>();

    const card = await (
      await apiClient.post("/api/v1/cards", {
        json: {
          name: "수정 전 카드",
          card_type: "debit",
          linked_account_id: account.id,
        },
      })
    ).json<{ id: number }>();

    const patchRes = await apiClient.patch(`/api/v1/cards/${card.id}`, {
      json: { name: "수정 후 카드" },
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json<{ name: string }>();
    expect(updated.name).toBe("수정 후 카드");
  });

  it("test_credit_card_auto_settlement", async () => {
    const checkingTypeId = await getAccountTypeId("CHECKING");
    const expenseCategoryId = await getCategoryId("외식", "식비");
    const cardPaymentId = await getPaymentMethodId("카드");

    const account = await (
      await apiClient.post("/api/v1/accounts", {
        json: {
          account_type_id: checkingTypeId,
          name: "자동결제 계좌",
          cash_balance: 200000,
        },
      })
    ).json<{ id: number }>();

    const card = await (
      await apiClient.post("/api/v1/cards", {
        json: {
          name: "삼성카드",
          card_type: "credit",
          settlement_account_id: account.id,
          due_day: 1,
        },
      })
    ).json<{ id: number }>();

    await apiClient.post("/api/v1/ledger-transactions", {
      json: {
        transaction_date: today,
        type: "expense",
        amount: 50000,
        category_id: expenseCategoryId,
        payment_method_id: cardPaymentId,
        card_id: card.id,
      },
    });

    const settlementRes = await apiClient.post(
      `/api/v1/cards/process-settlements?as_of=${today}`,
    );
    expect(settlementRes.status).toBe(200);
    const settlements = await settlementRes.json<Array<{ amount: string }>>();
    expect(settlements).toHaveLength(1);
    expect(Number(settlements[0].amount)).toBe(50000);

    const updated = await (
      await apiClient.get(`/api/v1/accounts/${account.id}`)
    ).json<{ cash_balance: string }>();
    expect(Number(updated.cash_balance)).toBe(150000);

    const liabilities = await (
      await apiClient.get("/api/v1/liabilities")
    ).json<Array<{ name: string; current_balance: string }>>();
    const credit = liabilities.find((item) => item.name === "삼성카드")!;
    expect(Number(credit.current_balance)).toBe(0);
  });
});
