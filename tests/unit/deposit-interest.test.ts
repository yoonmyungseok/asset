/**
 * @vitest-environment node
 */
import { format } from "date-fns";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  holdingAccruedInterest,
  holdingMarketValue,
  type HoldingLike,
} from "@/lib/utils";
import { apiClient } from "../helpers/api-client";
import { getAccountTypeId } from "../helpers/seed-ids";

const today = format(new Date(), "yyyy-MM-dd");

function deposit(
  principal: string,
  rate: string,
  start: string,
  maturity?: string,
): HoldingLike {
  return {
    asset_class: "deposit",
    quantity: new Decimal(principal),
    interest_rate: new Decimal(rate),
    start_date: new Date(`${start}T00:00:00`),
    maturity_date: maturity ? new Date(`${maturity}T00:00:00`) : null,
  };
}

describe("deposit interest", () => {
  it("returns zero interest without rate or start date", () => {
    const holding = deposit("10000000", "3.5", "2025-01-01");
    holding.interest_rate = null;
    expect(holdingAccruedInterest(holding, new Date("2025-07-01T00:00:00")).toFixed()).toBe("0");

    holding.interest_rate = new Decimal("3.5");
    holding.start_date = null;
    expect(holdingAccruedInterest(holding, new Date("2025-07-01T00:00:00")).toFixed()).toBe("0");
  });

  it("calculates monthly compound interest for 12 months", () => {
    const holding = deposit("10000000", "3.5", "2023-01-01");
    const asOf = new Date("2024-01-01T00:00:00");
    const expected = new Decimal("10000000")
      .times(new Decimal(1).plus(new Decimal("3.5").div(100).div(12)).pow(12).minus(1))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const accrued = holdingAccruedInterest(holding, asOf);
    expect(accrued.toFixed(2)).toBe(expected.toFixed(2));
    expect(holdingMarketValue(holding, asOf).toFixed(2)).toBe(
      new Decimal("10000000").plus(expected).toFixed(2),
    );
  });

  it("matches pension DC fixed deposit maturity amount", () => {
    const holding = deposit("475681", "3.15", "2025-09-09", "2026-09-09");
    const asOf = new Date("2026-09-11T00:00:00");
    expect(holdingAccruedInterest(holding, asOf).toFixed(2)).toBe("15202.19");
    expect(Math.round(Number(holdingMarketValue(holding, asOf).toFixed(2)))).toBe(490883);
  });

  it("stops interest accrual at maturity date", () => {
    const holding = deposit("10000000", "3.5", "2024-01-01", "2024-07-01");
    const accruedAtMaturity = holdingAccruedInterest(holding, new Date("2024-07-01T00:00:00"));
    const accruedAfterMaturity = holdingAccruedInterest(holding, new Date("2025-01-01T00:00:00"));
    const expected = new Decimal("10000000")
      .times(new Decimal(1).plus(new Decimal("3.5").div(100).div(12)).pow(6).minus(1))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(accruedAtMaturity.toFixed()).toBe(expected.toFixed());
    expect(accruedAfterMaturity.toFixed()).toBe(accruedAtMaturity.toFixed());
  });

  it("returns zero interest on the same start date", () => {
    const holding = deposit("10000000", "3.5", "2025-01-01");
    expect(holdingAccruedInterest(holding, new Date("2025-01-01T00:00:00")).toFixed()).toBe("0");
  });

  it("includes accrued interest in deposit holding API response", async () => {
    const dcTypeId = await getAccountTypeId("DC_PENSION");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: dcTypeId, name: "이자 테스트 DC", cash_balance: 0 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    const holdingRes = await apiClient.post("/api/v1/holdings", {
      json: {
        account_id: accountId,
        asset_class: "deposit",
        name: "퇴직연금 예금 (3.5%)",
        quantity: 10000000,
        interest_rate: 3.5,
        start_date: "2024-01-01",
        maturity_date: "2027-12-31",
      },
    });
    expect(holdingRes.status).toBe(201);
    const holding = await holdingRes.json<{
      quantity: string;
      accrued_interest: string;
      market_value: string;
      profit_loss: string;
    }>();
    expect(Number(holding.quantity)).toBe(10000000);
    expect(Number(holding.accrued_interest)).toBeGreaterThan(0);
    expect(Number(holding.market_value)).toBeGreaterThan(Number(holding.quantity));
    expect(Number(holding.profit_loss)).toBe(Number(holding.accrued_interest));
  });

  it("redeems deposit on sell with market value and removes holding", async () => {
    const dcTypeId = await getAccountTypeId("DC_PENSION");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: dcTypeId, name: "만기 해지 DC", cash_balance: 0 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    const holdingRes = await apiClient.post("/api/v1/holdings", {
      json: {
        account_id: accountId,
        asset_class: "deposit",
        name: "애큐온저축은행 정기예금 1년 (DC)",
        quantity: 475681,
        interest_rate: 3.15,
        start_date: "2025-09-09",
        maturity_date: "2026-09-09",
      },
    });
    const { id: holdingId } = await holdingRes.json<{ id: number }>();

    const sellRes = await apiClient.post("/api/v1/investment-transactions", {
      json: {
        account_id: accountId,
        type: "sell",
        transaction_date: "2026-09-09",
        asset_class: "deposit",
        holding_id: holdingId,
        amount: 0,
        fee: 0,
        memo: "만기 해지",
      },
    });
    expect(sellRes.status).toBe(201);
    const sellTx = await sellRes.json<{
      amount: string;
      quantity: string;
      fee: string;
      holding_id: number;
      holding_name: string;
    }>();
    expect(sellTx.holding_id).toBe(holdingId);
    expect(sellTx.holding_name).toBe("애큐온저축은행 정기예금 1년 (DC)");
    expect(Number(sellTx.quantity)).toBe(475681);
    expect(Math.round(Number(sellTx.amount))).toBe(490883);
    expect(Number(sellTx.fee)).toBe(0);

    const holdings = await (
      await apiClient.get(`/api/v1/holdings?account_id=${accountId}`)
    ).json<unknown[]>();
    expect(holdings).toHaveLength(0);

    const account = await (await apiClient.get(`/api/v1/accounts/${accountId}`)).json<{
      cash_balance: string;
    }>();
    expect(Math.round(Number(account.cash_balance))).toBe(490883);
  });

  it("resets accrual start date after interest transaction", async () => {
    const dcTypeId = await getAccountTypeId("DC_PENSION");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: dcTypeId, name: "이자 정산 DC", cash_balance: 0 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    const holdingRes = await apiClient.post("/api/v1/holdings", {
      json: {
        account_id: accountId,
        asset_class: "deposit",
        name: "정기예금",
        quantity: 10000000,
        interest_rate: 3.5,
        start_date: "2024-01-01",
      },
    });
    const { id: holdingId } = await holdingRes.json<{ id: number }>();

    const beforeHoldings = await (
      await apiClient.get(`/api/v1/holdings?account_id=${accountId}`)
    ).json<Array<{ accrued_interest: string }>>();
    const beforeInterest = beforeHoldings[0];
    const accruedBefore = Number(beforeInterest.accrued_interest);

    const interestRes = await apiClient.post("/api/v1/investment-transactions", {
      json: {
        account_id: accountId,
        type: "interest",
        transaction_date: today,
        holding_id: holdingId,
        amount: 50000,
        memo: "분기 이자",
      },
    });
    expect(interestRes.status).toBe(201);

    const afterHoldings = await (
      await apiClient.get(`/api/v1/holdings?account_id=${accountId}`)
    ).json<Array<{ quantity: string; accrued_interest: string; start_date: string }>>();
    const afterInterest = afterHoldings[0];
    expect(Number(afterInterest.quantity)).toBe(10050000);
    expect(Number(afterInterest.accrued_interest)).toBeLessThan(accruedBefore);
    expect(afterInterest.start_date).toBe(today);
  });
});
