import Decimal from "decimal.js";

// 거래소를 명시적으로 제한해 잘못된 기관의 시세를 사용하지 않는다.
const EXCHANGE_URLS: Record<string, string> = {
  빗썸: "https://api.bithumb.com/v1/ticker",
  업비트: "https://api.upbit.com/v1/ticker",
};

/** 거래소 공개 API에서 원화 마켓의 현재가를 조회한다. */
export async function getCryptoQuote(exchange: string | null, symbol: string): Promise<Decimal> {
  const baseUrl = exchange ? EXCHANGE_URLS[exchange] : undefined;
  const normalized = symbol.trim().toUpperCase();
  if (!baseUrl || !/^[A-Z0-9]{1,20}$/.test(normalized)) {
    throw new Error("거래소 또는 코인 심볼이 올바르지 않습니다.");
  }
  const market = `KRW-${normalized}`;
  const response = await fetch(`${baseUrl}?markets=${encodeURIComponent(market)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("암호화폐 시세 조회 실패");
  const data: unknown = await response.json();
  if (!Array.isArray(data) || data[0]?.market !== market || typeof data[0]?.trade_price !== "number") {
    throw new Error("암호화폐 시세 응답이 올바르지 않습니다.");
  }
  const price = new Decimal(data[0].trade_price);
  if (!price.isFinite() || !price.gt(0)) throw new Error("암호화폐 시세가 올바르지 않습니다.");
  return price;
}
