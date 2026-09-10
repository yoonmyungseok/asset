import { describe, expect, it } from "vitest";

import { formatMoney, serializeDecimal, toDecimal } from "@/lib/decimal";

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
});
