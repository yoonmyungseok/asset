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

  it("calculates simple interest for 365 days", () => {
    const holding = deposit("10000000", "3.5", "2023-01-01");
    const accrued = holdingAccruedInterest(holding, new Date("2024-01-01T00:00:00"));
    expect(accrued.toFixed(2)).toBe("350000.00");
    expect(holdingMarketValue(holding, new Date("2024-01-01T00:00:00")).toFixed(2)).toBe(
      "10350000.00",
    );
  });

  it("stops interest accrual at maturity date", () => {
    const holding = deposit("10000000", "3.5", "2024-01-01", "2024-07-01");
    const accruedAtMaturity = holdingAccruedInterest(holding, new Date("2024-07-01T00:00:00"));
    const accruedAfterMaturity = holdingAccruedInterest(holding, new Date("2025-01-01T00:00:00"));
    const days =
      (new Date("2024-07-01T00:00:00").getTime() - new Date("2024-01-01T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24);
    const expected = new Decimal("10000000")
      .times("3.5")
      .div(100)
      .times(days)
      .div(365)
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
