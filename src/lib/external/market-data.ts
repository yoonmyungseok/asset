import Decimal from "decimal.js";

import { toDecimal } from "@/lib/decimal";
import * as tossInvest from "@/lib/external/toss-invest";
import type { MarketQuoteResponse, MarketSearchItem } from "@/lib/validations/system";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}";
const NAVER_BASIC_URL = "https://m.stock.naver.com/api/stock/{code}/basic";
const USER_AGENT = "Mozilla/5.0 (compatible; AssetApp/1.0)";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 300;

type ChartCacheEntry = {
  expiresAt: number;
  meta: Record<string, unknown>;
  closes: Array<number | null> | null;
};

const chartCache = new Map<string, ChartCacheEntry>();
const naverCache = new Map<string, { expiresAt: number; data: Record<string, unknown> }>();
let lastRequestAt = 0;

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export function getProviderName(): string {
  return tossInvest.isTossConfigured() ? "toss" : "fallback";
}

export function extractKoreanCode(symbol: string): string | null {
  return tossInvest.extractKoreanCode(symbol);
}

export function normalizeSymbolQuery(query: string): string {
  const cleaned = query.trim().toUpperCase().replace(/\.$/, "");
  const match = /^([A-Z0-9]{6})(?:\.(KS|KQ))?$/.exec(cleaned);
  if (match) {
    const [, code, suffix] = match;
    return suffix ? `${code}.${suffix}` : code;
  }
  return cleaned;
}

export function buildSymbolCandidates(query: string): string[] {
  const normalized = normalizeSymbolQuery(query);
  if (/^\d{6}$/.test(normalized)) {
    return [`${normalized}.KS`, `${normalized}.KQ`];
  }
  if (/^[A-Z0-9]{6}$/.test(normalized)) {
    return [normalized];
  }
  if (/\.(KS|KQ)$/.test(normalized)) {
    return [normalized];
  }
  return normalized ? [normalized] : [];
}

export function parseDisplayPrice(value: string | null | undefined): Decimal | null {
  if (!value) {
    return null;
  }
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) {
    return null;
  }
  return toDecimal(cleaned);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

async function fetchNaverBasic(code: string): Promise<Record<string, unknown> | null> {
  const cached = naverCache.get(code);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  await throttle();
  const url = NAVER_BASIC_URL.replace("{code}", code);
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.status !== 200) {
      return null;
    }
    const data = (await response.json()) as Record<string, unknown>;
    if (!data.stockName) {
      return null;
    }
    naverCache.set(code, { expiresAt: Date.now() + CACHE_TTL_MS, data });
    return data;
  } catch {
    return null;
  }
}

function symbolFromNaver(code: string, data: Record<string, unknown>): string {
  const exchange = (data.stockExchangeType as Record<string, unknown> | undefined)?.code;
  const suffix = exchange === "KQ" ? "KQ" : "KS";
  return `${code}.${suffix}`;
}

async function fetchChart(symbol: string): Promise<[Record<string, unknown>, Array<number | null> | null]> {
  const cached = chartCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return [cached.meta, cached.closes];
  }

  await throttle();
  const url = YAHOO_CHART_URL.replace("{symbol}", symbol);
  let response: Response;
  try {
    response = await fetch(`${url}?interval=1d&range=5d`, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch {
    throw new Error("시세 조회 실패");
  }

  if (response.status === 429) {
    throw new RateLimitError("시세 서버 요청 한도 초과. 잠시 후 다시 시도하세요.");
  }
  if (response.status !== 200) {
    throw new Error("시세 조회 실패");
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const chart = payload.chart as Record<string, unknown> | undefined;
  const results = (chart?.result as Array<Record<string, unknown>> | undefined) ?? [];
  if (results.length === 0) {
    throw new Error("시세 조회 실패");
  }

  const meta = (results[0].meta as Record<string, unknown> | undefined) ?? {};
  if (!meta.symbol) {
    throw new Error("시세 조회 실패");
  }

  const indicators = results[0].indicators as Record<string, unknown> | undefined;
  const quote = (indicators?.quote as Array<Record<string, unknown>> | undefined)?.[0];
  const closes = (quote?.close as Array<number | null> | undefined) ?? null;
  chartCache.set(symbol, { expiresAt: Date.now() + CACHE_TTL_MS, meta, closes });
  return [meta, closes];
}

function extractPrice(meta: Record<string, unknown>, closes: Array<number | null> | null): Decimal | null {
  for (const key of ["regularMarketPrice", "previousClose"]) {
    const value = meta[key];
    if (value != null) {
      return toDecimal(value as Decimal.Value);
    }
  }
  if (closes) {
    for (let index = closes.length - 1; index >= 0; index -= 1) {
      const value = closes[index];
      if (value != null) {
        return toDecimal(value);
      }
    }
  }
  return null;
}

async function lookupSymbolFallback(symbol: string): Promise<MarketSearchItem | null> {
  const code = extractKoreanCode(symbol) ?? symbol.trim().toUpperCase().split(".")[0];
  if (/^[A-Z0-9]{6}$/.test(code)) {
    const data = await fetchNaverBasic(code);
    if (data && data.stockName) {
      return {
        symbol: symbolFromNaver(code, data),
        name: String(data.stockName),
      };
    }
  }

  try {
    const [meta] = await fetchChart(symbol);
    const name = meta.shortName ?? meta.longName;
    if (!name) {
      return null;
    }
    return { symbol, name: String(name) };
  } catch {
    return null;
  }
}

async function quoteFallback(symbol: string): Promise<MarketQuoteResponse> {
  const code = extractKoreanCode(symbol);
  if (code) {
    const data = await fetchNaverBasic(code);
    if (data) {
      const price = parseDisplayPrice(String(data.closePrice ?? ""));
      if (price != null) {
        return {
          symbol: symbolFromNaver(code, data),
          name: data.stockName != null ? String(data.stockName) : null,
          price,
          currency: "KRW",
          updated_at: new Date(),
        };
      }
    }
  }

  const [meta, closes] = await fetchChart(symbol);
  const price = extractPrice(meta, closes);
  if (price == null) {
    throw new Error("시세 조회 실패");
  }

  return {
    symbol,
    name: meta.shortName != null ? String(meta.shortName) : meta.longName != null ? String(meta.longName) : null,
    price,
    currency: meta.currency != null ? String(meta.currency) : "KRW",
    updated_at: new Date(),
  };
}

async function lookupSymbol(symbol: string): Promise<MarketSearchItem | null> {
  if (tossInvest.isTossConfigured()) {
    try {
      const results = await tossInvest.searchStocks(symbol);
      return results[0] ?? null;
    } catch (error) {
      if (error instanceof tossInvest.TossRateLimitError) {
        throw new RateLimitError(String(error.message));
      }
      if (!(error instanceof tossInvest.TossApiError)) {
        throw error;
      }
    }
  }
  return lookupSymbolFallback(symbol);
}

export async function getQuote(symbol: string): Promise<MarketQuoteResponse> {
  if (tossInvest.isTossConfigured()) {
    try {
      return await tossInvest.getQuote(symbol);
    } catch (error) {
      if (error instanceof tossInvest.TossRateLimitError) {
        throw new RateLimitError(String(error.message));
      }
      if (!(error instanceof tossInvest.TossApiError)) {
        throw error;
      }
    }
  }
  return quoteFallback(symbol);
}

export async function searchMarket(query: string): Promise<MarketSearchItem[]> {
  if (tossInvest.isTossConfigured()) {
    try {
      const results = await tossInvest.searchStocks(query);
      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      if (error instanceof tossInvest.TossRateLimitError) {
        throw new RateLimitError(String(error.message));
      }
      if (!(error instanceof tossInvest.TossApiError)) {
        throw error;
      }
    }
  }

  const normalized = normalizeSymbolQuery(query);
  if (/^[A-Z0-9]{6}$/.test(normalized)) {
    if (/^\d{6}$/.test(normalized)) {
      const item =
        (await lookupSymbolFallback(`${normalized}.KS`)) ?? (await lookupSymbolFallback(`${normalized}.KQ`));
      return item ? [item] : [];
    }
    const item = await lookupSymbolFallback(normalized);
    return item ? [item] : [];
  }

  const candidates = buildSymbolCandidates(query);
  if (candidates.length === 0) {
    return [];
  }

  const results: MarketSearchItem[] = [];
  let rateLimited = false;

  for (const symbol of candidates) {
    try {
      const item = await lookupSymbol(symbol);
      if (item) {
        results.push(item);
        break;
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        rateLimited = true;
        break;
      }
      throw error;
    }
  }

  if (rateLimited && results.length === 0) {
    throw new RateLimitError("시세 서버 요청 한도 초과. 잠시 후 다시 시도하세요.");
  }

  return results;
}
