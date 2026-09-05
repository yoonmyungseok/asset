import re
import time
from datetime import datetime, timedelta
from decimal import Decimal

import httpx

from app.external import toss_invest
from app.schemas.system import MarketQuoteResponse, MarketSearchItem
from app.utils import to_decimal

YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
NAVER_BASIC_URL = "https://m.stock.naver.com/api/stock/{code}/basic"
USER_AGENT = "Mozilla/5.0 (compatible; AssetApp/1.0)"
CACHE_TTL = timedelta(hours=6)
MIN_REQUEST_INTERVAL = 0.3

_cache: dict[str, tuple[datetime, dict, list | None]] = {}
_naver_cache: dict[str, tuple[datetime, dict]] = {}
_last_request_at = 0.0


class RateLimitError(ValueError):
    pass


def get_provider_name() -> str:
    return "toss" if toss_invest.is_toss_configured() else "fallback"


def extract_korean_code(symbol: str) -> str | None:
    return toss_invest.extract_korean_code(symbol)


def normalize_symbol_query(query: str) -> str:
    cleaned = query.strip().upper().rstrip(".")
    match = re.fullmatch(r"([A-Z0-9]{6})(?:\.(KS|KQ))?", cleaned)
    if match:
        code, suffix = match.groups()
        return f"{code}.{suffix}" if suffix else code
    return cleaned


def build_symbol_candidates(query: str) -> list[str]:
    normalized = normalize_symbol_query(query)
    if re.fullmatch(r"\d{6}", normalized):
        return [f"{normalized}.KS", f"{normalized}.KQ"]
    if re.fullmatch(r"[A-Z0-9]{6}", normalized):
        return [normalized]
    if re.search(r"\.(KS|KQ)$", normalized):
        return [normalized]
    return [normalized] if normalized else []


def parse_display_price(value: str | None) -> Decimal | None:
    if not value:
        return None
    cleaned = value.replace(",", "").strip()
    if not cleaned:
        return None
    return to_decimal(cleaned)


def _throttle() -> None:
    global _last_request_at
    elapsed = time.monotonic() - _last_request_at
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    _last_request_at = time.monotonic()


def _fetch_naver_basic(code: str) -> dict | None:
    cached = _naver_cache.get(code)
    if cached and datetime.utcnow() - cached[0] < CACHE_TTL:
        return cached[1]

    _throttle()
    url = NAVER_BASIC_URL.format(code=code)
    try:
        with httpx.Client(timeout=10.0, headers={"User-Agent": USER_AGENT}) as client:
            response = client.get(url)
    except httpx.HTTPError:
        return None

    if response.status_code != 200:
        return None

    data = response.json()
    if not data.get("stockName"):
        return None

    _naver_cache[code] = (datetime.utcnow(), data)
    return data


def _symbol_from_naver(code: str, data: dict) -> str:
    exchange = (data.get("stockExchangeType") or {}).get("code", "KS")
    suffix = "KQ" if exchange == "KQ" else "KS"
    return f"{code}.{suffix}"


def _lookup_symbol_fallback(symbol: str) -> MarketSearchItem | None:
    code = extract_korean_code(symbol) or symbol.strip().upper().split(".")[0]
    if re.fullmatch(r"[A-Z0-9]{6}", code):
        data = _fetch_naver_basic(code)
        if data:
            return MarketSearchItem(symbol=_symbol_from_naver(code, data), name=data["stockName"])

    try:
        meta, _ = _fetch_chart(symbol)
    except ValueError:
        return None

    name = meta.get("shortName") or meta.get("longName")
    if not name:
        return None
    return MarketSearchItem(symbol=symbol, name=name)


def _quote_fallback(symbol: str) -> MarketQuoteResponse:
    code = extract_korean_code(symbol)
    if code:
        data = _fetch_naver_basic(code)
        if data:
            price = parse_display_price(data.get("closePrice"))
            if price is not None:
                return MarketQuoteResponse(
                    symbol=_symbol_from_naver(code, data),
                    name=data.get("stockName"),
                    price=price,
                    currency="KRW",
                    updated_at=datetime.utcnow(),
                )

    meta, closes = _fetch_chart(symbol)
    price = _extract_price(meta, closes)
    if price is None:
        raise ValueError("시세 조회 실패")

    return MarketQuoteResponse(
        symbol=symbol,
        name=meta.get("shortName") or meta.get("longName"),
        price=price,
        currency=meta.get("currency", "KRW"),
        updated_at=datetime.utcnow(),
    )


def _fetch_chart(symbol: str) -> tuple[dict, list | None]:
    cached = _cache.get(symbol)
    if cached and datetime.utcnow() - cached[0] < CACHE_TTL:
        return cached[1], cached[2]

    _throttle()
    url = YAHOO_CHART_URL.format(symbol=symbol)
    try:
        with httpx.Client(timeout=10.0, headers={"User-Agent": USER_AGENT}) as client:
            response = client.get(url, params={"interval": "1d", "range": "5d"})
    except httpx.HTTPError as exc:
        raise ValueError("시세 조회 실패") from exc

    if response.status_code == 429:
        raise RateLimitError("시세 서버 요청 한도 초과. 잠시 후 다시 시도하세요.")
    if response.status_code != 200:
        raise ValueError("시세 조회 실패")

    payload = response.json()
    results = payload.get("chart", {}).get("result") or []
    if not results:
        raise ValueError("시세 조회 실패")

    meta = results[0].get("meta") or {}
    if not meta.get("symbol"):
        raise ValueError("시세 조회 실패")

    closes = results[0].get("indicators", {}).get("quote", [{}])[0].get("close")
    _cache[symbol] = (datetime.utcnow(), meta, closes)
    return meta, closes


def _extract_price(meta: dict, closes: list | None) -> Decimal | None:
    for value in (meta.get("regularMarketPrice"), meta.get("previousClose")):
        if value is not None:
            return to_decimal(value)
    if closes:
        for value in reversed(closes):
            if value is not None:
                return to_decimal(value)
    return None


def lookup_symbol(symbol: str) -> MarketSearchItem | None:
    if toss_invest.is_toss_configured():
        try:
            return toss_invest.lookup_symbol(symbol)
        except toss_invest.TossRateLimitError as exc:
            raise RateLimitError(str(exc)) from exc
        except toss_invest.TossApiError:
            pass
    return _lookup_symbol_fallback(symbol)


def get_quote(symbol: str) -> MarketQuoteResponse:
    if toss_invest.is_toss_configured():
        try:
            return toss_invest.get_quote(symbol)
        except toss_invest.TossRateLimitError as exc:
            raise RateLimitError(str(exc)) from exc
        except toss_invest.TossApiError:
            pass
    return _quote_fallback(symbol)


def search_symbols(query: str) -> list[MarketSearchItem]:
    if toss_invest.is_toss_configured():
        try:
            results = toss_invest.search_symbols(query)
            if results:
                return results
        except toss_invest.TossRateLimitError as exc:
            raise RateLimitError(str(exc)) from exc
        except toss_invest.TossApiError:
            pass

    normalized = normalize_symbol_query(query)
    if re.fullmatch(r"[A-Z0-9]{6}", normalized):
        if re.fullmatch(r"\d{6}", normalized):
            item = _lookup_symbol_fallback(f"{normalized}.KS") or _lookup_symbol_fallback(f"{normalized}.KQ")
        else:
            item = _lookup_symbol_fallback(normalized)
        if item:
            return [item]

    candidates = build_symbol_candidates(query)
    if not candidates:
        return []

    results: list[MarketSearchItem] = []
    rate_limited = False

    for symbol in candidates:
        try:
            item = lookup_symbol(symbol)
        except RateLimitError:
            rate_limited = True
            break
        if item:
            results.append(item)
            break

    if rate_limited and not results:
        raise RateLimitError("시세 서버 요청 한도 초과. 잠시 후 다시 시도하세요.")

    return results
