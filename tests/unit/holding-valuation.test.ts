import { describe, expect, it } from "vitest";

import { holdingCostBasis, holdingMarketValue } from "@/lib/utils";

describe("holding valuation rounding", () => {
  it("rounds cost basis down on exact half-won boundaries", () => {
    const basis = holdingCostBasis({
      quantity: 2,
      avg_cost_price: "5323127.75",
    });
    expect(basis.toNumber()).toBe(10646255);
  });

  it("matches pension app cost basis for ACE example", () => {
    const basis = holdingCostBasis({
      quantity: 94,
      avg_cost_price: "14164.57",
    });
    expect(basis.toNumber()).toBe(1331470);
  });

  it("uses stored book cost when provided", () => {
    const basis = holdingCostBasis({
      quantity: 400,
      avg_cost_price: "26615.64",
      book_cost: "10646255",
    });
    expect(basis.toNumber()).toBe(10646255);
  });

  it("rounds market value up to whole won", () => {
    const value = holdingMarketValue({
      quantity: 94,
      last_market_price: "13650",
    });
    expect(value.toNumber()).toBe(1283100);
  });
});
