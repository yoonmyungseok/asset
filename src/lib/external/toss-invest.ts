import Decimal from "decimal.js";

import { getTossCredentials } from "@/lib/config";
import { toDecimal } from "@/lib/decimal";
import type { MarketQuoteResponse, MarketSearchItem } from "@/lib/validations/system";

const MARKET_SUFFIX: Record<string, string> = {
  KOSPI: "KS",
  KOSDAQ: "KQ",
  KONEX: "KQ",
};

const KOREAN_SYMBOL_RE = /^([A-Z0-9]{6})(?:\.(KS|KQ))?$/;

const tokenCache = {
  token: null as string | null,
  expiresAt: new Date(0),
  lock: Promise.resolve(),
};

export class TossApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TossApiError";
  }
}

export class TossRateLimitError extends TossApiError {
  constructor(message: string) {
    super(message);
    this.name = "TossRateLimitError";
  }
}

export function isTossConfigured(): boolean {
  return !!(process.env.TOSS_CLIENT_ID && process.env.TOSS_CLIENT_SECRET);
}

export async function isTossConfiguredAsync(): Promise<boolean> {
  const credentials = await getTossCredentials();
  return !!(credentials.clientId && credentials.clientSecret);
}

export function extractKoreanCode(symbol: string): string | null {
  const match = KOREAN_SYMBOL_RE.exec(symbol.trim().toUpperCase());
  return match ? match[1] : null;
}

export function toTossSymbol(symbol: string): string {
  const code = extractKoreanCode(symbol);
  if (code) {
    return code;
  }
  return symbol.trim().toUpperCase().split(".")[0];
}

export function toAppSymbol(tossSymbol: string, market?: string | null): string {
  if (/^[A-Z0-9]{6}$/.test(tossSymbol) && market) {
    const suffix = MARKET_SUFFIX[market.toUpperCase()];
    if (suffix) {
      return `${tossSymbol}.${suffix}`;
    }
  }
  return tossSymbol;
}

async function withTokenLock<T>(fn: () => Promise<T>): Promise<T> {
  const current = tokenCache.lock;
  let release!: () => void;
  tokenCache.lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await current;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function baseUrl(): Promise<string> {
  const credentials = await getTossCredentials();
  return credentials.baseUrl.replace(/\/$/, "");
}

function parseApiPayload(payload: Record<string, unknown>): unknown {
  if ("result" in payload) {
    return payload.result;
  }
  if (["items", "stocks", "prices", "data"].some((key) => key in payload)) {
    return payload;
  }
  if (payload.error) {
    const error = payload.error;
    if (typeof error === "object" && error !== null) {
      const errorObj = error as Record<string, unknown>;
      let message = String(errorObj.message ?? "토스증권 API 오류");
      const code = errorObj.code;
      if (code) {
        message = `${message} (${String(code)})`;
      }
      throw new TossApiError(message);
    }
    throw new TossApiError(String(error));
  }
  throw new TossApiError("토스증권 API 응답 형식 오류");
}

export function parseOauthToken(payload: Record<string, unknown>): [string, number] {
  if (payload.error) {
    const description = payload.error_description ?? payload.error;
    throw new TossApiError(`토스증권 인증 실패: ${String(description)}`);
  }

  const candidates: Record<string, unknown>[] = [payload];
  const result = payload.result;
  if (typeof result === "object" && result !== null) {
    candidates.push(result as Record<string, unknown>);
  }

  for (const data of candidates) {
    const token = data.access_token ?? data.accessToken;
    if (token) {
      const expiresIn = data.expires_in ?? data.expiresIn ?? 86400;
      return [String(token), Number(expiresIn)];
    }
  }

  throw new TossApiError("토스증권 액세스 토큰을 받지 못했습니다.");
}

async function requestToken(clientId: string, clientSecret: string): Promise<[string, Date]> {
  const url = `${await baseUrl()}/oauth2/token`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (response.status === 429) {
    throw new TossRateLimitError("토스증권 API 요청 한도 초과");
  }
  if (response.status !== 200) {
    throw new TossApiError("토스증권 인증 실패. Client ID/Secret을 확인하세요.");
  }

  const [token, expiresIn] = parseOauthToken((await response.json()) as Record<string, unknown>);
  const expiresAt = new Date(Date.now() + Math.max(expiresIn - 60, 60) * 1000);
  return [token, expiresAt];
}

export async function getAccessToken(): Promise<string> {
  const credentials = await getTossCredentials();
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new TossApiError("토스증권 API가 설정되지 않았습니다.");
  }

  return withTokenLock(async () => {
    if (tokenCache.token && new Date() < tokenCache.expiresAt) {
      return tokenCache.token;
    }

    const [token, expiresAt] = await requestToken(credentials.clientId!, credentials.clientSecret!);
    tokenCache.token = token;
    tokenCache.expiresAt = expiresAt;
    return token;
  });
}

function asList(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  }
  if (typeof result === "object" && result !== null) {
    const record = result as Record<string, unknown>;
    for (const key of ["items", "stocks", "prices", "data"]) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
      }
    }
    if (Object.values(record).every((value) => typeof value === "object" && value !== null)) {
      const items: Record<string, unknown>[] = [];
      for (const [symbol, data] of Object.entries(record)) {
        items.push({ ...(data as Record<string, unknown>), symbol });
      }
      return items;
    }
    return [record];
  }
  return [];
}

async function apiGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(`${await baseUrl()}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const request = async (token: string) =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let token = await getAccessToken();
  let response = await request(token);

  if (response.status === 401) {
    await withTokenLock(async () => {
      tokenCache.token = null;
      tokenCache.expiresAt = new Date(0);
    });
    token = await getAccessToken();
    response = await request(token);
  }

  if (response.status === 429) {
    throw new TossRateLimitError("토스증권 API 요청 한도 초과");
  }
  if (response.status !== 200) {
    throw new TossApiError(`토스증권 API 호출 실패 (HTTP ${response.status})`);
  }

  return parseApiPayload((await response.json()) as Record<string, unknown>);
}

async function getStocks(symbols: string[]): Promise<Record<string, unknown>[]> {
  if (symbols.length === 0) {
    return [];
  }
  const result = await apiGet("/api/v1/stocks", { symbols: symbols.join(",") });
  return asList(result);
}

async function getPrices(symbols: string[]): Promise<Record<string, unknown>[]> {
  if (symbols.length === 0) {
    return [];
  }
  const result = await apiGet("/api/v1/prices", { symbols: symbols.join(",") });
  return asList(result);
}

function stockName(stock: Record<string, unknown>): string | null {
  const name = stock.name ?? stock.stockName;
  return name != null ? String(name) : null;
}

function stockMarket(stock: Record<string, unknown>): string | null {
  const market = stock.market ?? stock.marketCode;
  return market != null ? String(market) : null;
}

function priceValue(price: Record<string, unknown>): Decimal | null {
  for (const key of ["lastPrice", "last_price", "price", "closePrice"]) {
    const value = price[key];
    if (value != null && (typeof value === "string" || typeof value === "number" || value instanceof Decimal)) {
      return toDecimal(value);
    }
  }
  return null;
}

export function parseTossPriceTimestamp(value: unknown): Date | null {
  if (value == null) {
    return null;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function lookupSymbol(symbol: string): Promise<MarketSearchItem | null> {
  const tossSymbol = toTossSymbol(symbol);
  const stocks = await getStocks([tossSymbol]);
  if (stocks.length === 0) {
    return null;
  }
  const stock = stocks[0];
  const name = stockName(stock);
  if (!name) {
    return null;
  }
  const appSymbol = toAppSymbol(String(stock.symbol ?? tossSymbol), stockMarket(stock));
  return { symbol: appSymbol, name };
}

export async function getQuote(symbol: string): Promise<MarketQuoteResponse> {
  const tossSymbol = toTossSymbol(symbol);
  const stocks = await getStocks([tossSymbol]);
  const prices = await getPrices([tossSymbol]);

  const stock = stocks[0] ?? {};
  const priceRow = prices[0] ?? {};
  const price = priceValue(priceRow);
  if (price == null) {
    throw new TossApiError("시세 조회 실패");
  }

  const appSymbol = toAppSymbol(String(priceRow.symbol ?? tossSymbol), stockMarket(stock));
  const currency = String(priceRow.currency ?? stock.currency ?? "KRW");
  const updatedAt =
    parseTossPriceTimestamp(priceRow.timestamp ?? priceRow.tradedAt ?? priceRow.traded_at) ?? new Date();
  return {
    symbol: appSymbol,
    name: stockName(stock),
    price,
    currency,
    updated_at: updatedAt,
  };
}

export async function searchStocks(query: string): Promise<MarketSearchItem[]> {
  const cleaned = query.trim().toUpperCase().replace(/\.$/, "");
  const match = KOREAN_SYMBOL_RE.exec(cleaned);
  const symbol = match ? match[1] : cleaned.split(".")[0];
  if (!symbol || !/^[A-Z0-9.\-]+$/.test(symbol)) {
    return [];
  }

  const item = await lookupSymbol(symbol);
  return item ? [item] : [];
}

export async function verifyConnection(): Promise<void> {
  await getPrices(["005930"]);
}

export async function clearTokenCache(): Promise<void> {
  await withTokenLock(async () => {
    tokenCache.token = null;
    tokenCache.expiresAt = new Date(0);
  });
}
