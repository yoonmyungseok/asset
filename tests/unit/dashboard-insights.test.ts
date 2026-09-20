import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  computeDebtRatio,
  computeEmergencyMonths,
  computeSavingsRate,
  sumCashCategoryAccounts,
} from "@/lib/services/dashboard-insights";

describe("dashboard-insights", () => {
  it("computeSavingsRate returns null when income is zero", () => {
    expect(computeSavingsRate(new Decimal(0), new Decimal(100))).toBeNull();
  });

  it("computeSavingsRate calculates monthly savings rate", () => {
    expect(computeSavingsRate(new Decimal(1000000), new Decimal(250000))?.toFixed(2)).toBe(
      "75.00",
    );
  });

  it("sumCashCategoryAccounts sums only cash category", () => {
    const total = sumCashCategoryAccounts([
      { category: "cash", total_value: new Decimal(300000) },
      { category: "deposit", total_value: new Decimal(500000) },
    ]);
    expect(total.toFixed()).toBe("300000");
  });

  it("computeEmergencyMonths returns null when average expense is zero", () => {
    expect(computeEmergencyMonths(new Decimal(100000), new Decimal(0))).toBeNull();
  });

  it("computeDebtRatio matches liabilities over assets", () => {
    expect(computeDebtRatio(new Decimal(200000), new Decimal(800000))?.toFixed(2)).toBe("25.00");
  });
});
