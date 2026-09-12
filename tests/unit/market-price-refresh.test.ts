import { describe, expect, it } from "vitest";

import {
  MARKET_PRICE_REFRESH_MAX_AGE_MS,
  needsMarketPriceRefresh,
} from "@/lib/utils/format";

describe("needsMarketPriceRefresh", () => {
  it("returns true when price was never updated", () => {
    expect(needsMarketPriceRefresh(null)).toBe(true);
    expect(needsMarketPriceRefresh(undefined)).toBe(true);
  });

  it("returns false for a recent update", () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    expect(needsMarketPriceRefresh(recent)).toBe(false);
    expect(needsMarketPriceRefresh(recent.toISOString())).toBe(false);
  });

  it("returns true when update is older than the refresh window", () => {
    const stale = new Date(Date.now() - MARKET_PRICE_REFRESH_MAX_AGE_MS - 1);
    expect(needsMarketPriceRefresh(stale)).toBe(true);
  });
});
