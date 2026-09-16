import { describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";

import {
  buildSymbolCandidates,
  extractKoreanCode,
  getProviderName,
  normalizeSymbolQuery,
  parseDisplayPrice,
} from "@/lib/external/market-data";
import * as tossInvest from "@/lib/external/toss-invest";

describe("market data helpers", () => {
  it("strips trailing dot from symbol query", () => {
    expect(normalizeSymbolQuery("379780.")).toBe("379780");
  });

  it("normalizes market suffix casing", () => {
    expect(normalizeSymbolQuery("005930.ks")).toBe("005930.KS");
  });

  it("builds KS and KQ candidates for six digit codes", () => {
    expect(buildSymbolCandidates("379780")).toEqual(["379780.KS", "379780.KQ"]);
  });

  it("builds candidates for trailing dot input", () => {
    expect(buildSymbolCandidates("379780.")).toEqual(["379780.KS", "379780.KQ"]);
  });

  it("keeps explicit suffix candidates", () => {
    expect(buildSymbolCandidates("005930.KS")).toEqual(["005930.KS"]);
  });

  it("keeps alphanumeric six character codes", () => {
    expect(buildSymbolCandidates("0177R0")).toEqual(["0177R0"]);
  });

  it("normalizes alphanumeric symbol queries", () => {
    expect(normalizeSymbolQuery("0177R0")).toBe("0177R0");
    expect(normalizeSymbolQuery("0177R0.KS")).toBe("0177R0.KS");
  });

  it("extracts korean stock codes", () => {
    expect(extractKoreanCode("379780.KS")).toBe("379780");
    expect(extractKoreanCode("123456.KQ")).toBe("123456");
    expect(extractKoreanCode("0177R0")).toBe("0177R0");
    expect(extractKoreanCode("0177R0.KS")).toBe("0177R0");
    expect(extractKoreanCode("AAPL")).toBeNull();
  });

  it("parses naver display prices", () => {
    expect(parseDisplayPrice("22,610")?.toFixed()).toBe(new Decimal("22610").toFixed());
    expect(parseDisplayPrice("")).toBeNull();
  });

  it("maps toss symbols to app symbols", () => {
    expect(tossInvest.toAppSymbol("379780", "KOSPI")).toBe("379780.KS");
    expect(tossInvest.toAppSymbol("123456", "KOSDAQ")).toBe("123456.KQ");
    expect(tossInvest.toAppSymbol("0177R0", "KOSPI")).toBe("0177R0.KS");
  });

  it("maps app symbols to toss symbols", () => {
    expect(tossInvest.toTossSymbol("379780.KS")).toBe("379780");
    expect(tossInvest.toTossSymbol("0177R0.KS")).toBe("0177R0");
    expect(tossInvest.toTossSymbol("AAPL")).toBe("AAPL");
  });

  it("parses toss price timestamps", () => {
    const parsed = tossInvest.parseTossPriceTimestamp("2026-09-15T15:59:44.000+09:00");
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
  });

  it("parses flat oauth token responses", () => {
    const [token, expiresIn] = tossInvest.parseOauthToken({
      access_token: "abc123",
      token_type: "Bearer",
      expires_in: 86400,
    });
    expect(token).toBe("abc123");
    expect(expiresIn).toBe(86400);
  });

  it("parses wrapped oauth token responses", () => {
    const [token, expiresIn] = tossInvest.parseOauthToken({
      result: {
        accessToken: "wrapped",
        expiresIn: 3600,
      },
    });
    expect(token).toBe("wrapped");
    expect(expiresIn).toBe(3600);
  });

  it("returns fallback provider without credentials", () => {
    vi.spyOn(tossInvest, "isTossConfigured").mockReturnValue(false);
    expect(getProviderName()).toBe("fallback");
  });
});
