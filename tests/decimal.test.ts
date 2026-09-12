import { describe, expect, it } from "vitest";

import {
  formatMoney,
  roundAvgCostPrice,
  roundAvgCostPriceDisplay,
  serializeDecimal,
  toDecimal,
} from "@/lib/decimal";

describe("decimal helpers", () => {
  it("converts values to Decimal with null fallback", () => {
    expect(toDecimal(null).toFixed()).toBe("0");
    expect(toDecimal("12.5").toFixed()).toBe("12.5");
  });

  it("formats money in KRW", () => {
    expect(formatMoney(12345)).toBe("12,345원");
  });

  it("serializes decimal values as strings", () => {
    expect(serializeDecimal("99.99")).toBe("99.99");
  });

  it("rounds average cost price to 4 decimal places for storage", () => {
    expect(roundAvgCostPrice("70000.12659").toFixed()).toBe("70000.1266");
    expect(roundAvgCostPrice("70000").toFixed()).toBe("70000");
  });

  it("rounds average cost price to 2 decimal places for display", () => {
    expect(roundAvgCostPriceDisplay("70000.126").toFixed()).toBe("70000.13");
    expect(roundAvgCostPriceDisplay("70000.5").toFixed()).toBe("70000.5");
  });
});
