import { afterEach, describe, expect, it, vi } from "vitest";

import { getCryptoQuote } from "./crypto-market-data";

afterEach(() => vi.unstubAllGlobals());

describe("암호화폐 원화 시세", () => {
  it.each([
    ["빗썸", "api.bithumb.com"],
    ["업비트", "api.upbit.com"],
  ])("%s의 해당 원화 마켓을 조회한다", async (exchange, host) => {
    // 응답 마켓과 가격이 요청한 자산에 일치하는지 확인한다.
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ market: "KRW-BTC", trade_price: 12345 }] });
    vi.stubGlobal("fetch", fetchMock);
    expect((await getCryptoQuote(exchange, "btc")).toString()).toBe("12345");
    expect(fetchMock.mock.calls[0][0]).toContain(host);
    expect(fetchMock.mock.calls[0][0]).toContain("KRW-BTC");
  });

  it("잘못된 거래소와 다른 마켓 응답을 거부한다", async () => {
    await expect(getCryptoQuote("알 수 없음", "BTC")).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ market: "KRW-ETH", trade_price: 123 }] }));
    await expect(getCryptoQuote("빗썸", "BTC")).rejects.toThrow();
  });
});
