import re
import threading
import time
from datetime import datetime, timedelta
from decimal import Decimal

import httpx

from app.config import get_toss_credentials
from app.schemas.system import MarketQuoteResponse, MarketSearchItem
from app.utils import to_decimal

MARKET_SUFFIX = {
    "KOSPI": "KS",
    "KOSDAQ": "KQ",
    "KONEX": "KQ",
}

_token_cache: dict[str, object] = {
    "token": None,
    "expires_at": datetime.min,
    "lock": threading.Lock(),
}


class TossApiError(ValueError):
    pass


class TossRateLimitError(TossApiError):
    pass


def is_toss_configured() -> bool:
    client_id, client_secret = get_toss_credentials()
    return bool(client_id and client_secret)


KOREAN_SYMBOL_RE = re.compile(r"^([A-Z0-9]{6})(?:\.(KS|KQ))?$")


def extract_korean_code(symbol: str) -> str | None:
    match = KOREAN_SYMBOL_RE.match(symbol.strip().upper())
    return match.group(1) if match else None


def to_toss_symbol(symbol: str) -> str:
    code = extract_korean_code(symbol)
    if code:
        return code
    return symbol.strip().upper().split(".")[0]


def to_app_symbol(toss_symbol: str, market: str | None = None) -> str:
    if re.fullmatch(r"[A-Z0-9]{6}", toss_symbol) and market:
        suffix = MARKET_SUFFIX.get(market.upper())
        if suffix:
            return f"{toss_symbol}.{suffix}"
    return toss_symbol


def _base_url() -> str:
    from app.config import get_settings

    return get_settings().toss_base_url.rstrip("/")


def _parse_api_payload(payload: dict) -> object:
    if "result" in payload:
        return payload["result"]
    if any(key in payload for key in ("items", "stocks", "prices", "data")):
        return payload
    if payload.get("error"):
        error = payload["error"]
        if isinstance(error, dict):
            message = error.get("message") or "토스증권 API 오류"
            code = error.get("code")
            if code:
                message = f"{message} ({code})"
        else:
            message = str(error)
        raise TossApiError(message)
    raise TossApiError("토스증권 API 응답 형식 오류")


def _parse_oauth_token(payload: dict) -> tuple[str, int]:
    if payload.get("error"):
        description = payload.get("error_description") or payload.get("error")
        raise TossApiError(f"토스증권 인증 실패: {description}")

    candidates: list[dict] = [payload]
    result = payload.get("result")
    if isinstance(result, dict):
        candidates.append(result)

    for data in candidates:
        token = data.get("access_token") or data.get("accessToken")
        if token:
            expires_in = data.get("expires_in") or data.get("expiresIn") or 86400
            return str(token), int(expires_in)

    raise TossApiError("토스증권 액세스 토큰을 받지 못했습니다.")


def _request_token(client_id: str, client_secret: str) -> tuple[str, datetime]:
    url = f"{_base_url()}/oauth2/token"
    with httpx.Client(timeout=15.0) as client:
        response = client.post(
            url,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if response.status_code == 429:
        raise TossRateLimitError("토스증권 API 요청 한도 초과")
    if response.status_code != 200:
        raise TossApiError("토스증권 인증 실패. Client ID/Secret을 확인하세요.")

    token, expires_in = _parse_oauth_token(response.json())
    return token, datetime.utcnow() + timedelta(seconds=max(expires_in - 60, 60))


def _get_access_token() -> str:
    client_id, client_secret = get_toss_credentials()
    if not client_id or not client_secret:
        raise TossApiError("토스증권 API가 설정되지 않았습니다.")

    with _token_cache["lock"]:
        token = _token_cache["token"]
        expires_at = _token_cache["expires_at"]
        if isinstance(token, str) and datetime.utcnow() < expires_at:
            return token
        token, expires_at = _request_token(client_id, client_secret)
        _token_cache["token"] = token
        _token_cache["expires_at"] = expires_at
        return token


def _api_get(path: str, params: dict | None = None) -> object:
    token = _get_access_token()
    url = f"{_base_url()}{path}"
    with httpx.Client(timeout=15.0) as client:
        response = client.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )

    if response.status_code == 401:
        with _token_cache["lock"]:
            _token_cache["token"] = None
            _token_cache["expires_at"] = datetime.min
        token = _get_access_token()
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )

    if response.status_code == 429:
        raise TossRateLimitError("토스증권 API 요청 한도 초과")
    if response.status_code != 200:
        raise TossApiError(f"토스증권 API 호출 실패 (HTTP {response.status_code})")

    return _parse_api_payload(response.json())


def _as_list(result: object) -> list[dict]:
    if isinstance(result, list):
        return [item for item in result if isinstance(item, dict)]
    if isinstance(result, dict):
        for key in ("items", "stocks", "prices", "data"):
            value = result.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        if result and all(isinstance(value, dict) for value in result.values()):
            items: list[dict] = []
            for symbol, data in result.items():
                item = dict(data)
                item.setdefault("symbol", symbol)
                items.append(item)
            return items
        return [result]
    return []


def get_stocks(symbols: list[str]) -> list[dict]:
    if not symbols:
        return []
    result = _api_get("/api/v1/stocks", params={"symbols": ",".join(symbols)})
    return _as_list(result)


def get_prices(symbols: list[str]) -> list[dict]:
    if not symbols:
        return []
    result = _api_get("/api/v1/prices", params={"symbols": ",".join(symbols)})
    return _as_list(result)


def _stock_name(stock: dict) -> str | None:
    return stock.get("name") or stock.get("stockName")


def _stock_market(stock: dict) -> str | None:
    return stock.get("market") or stock.get("marketCode")


def _price_value(price: dict) -> Decimal | None:
    for key in ("lastPrice", "last_price", "price", "closePrice"):
        value = price.get(key)
        if value is not None:
            return to_decimal(value)
    return None


def lookup_symbol(symbol: str) -> MarketSearchItem | None:
    toss_symbol = to_toss_symbol(symbol)
    stocks = get_stocks([toss_symbol])
    if not stocks:
        return None
    stock = stocks[0]
    name = _stock_name(stock)
    if not name:
        return None
    app_symbol = to_app_symbol(stock.get("symbol") or toss_symbol, _stock_market(stock))
    return MarketSearchItem(symbol=app_symbol, name=name)


def get_quote(symbol: str) -> MarketQuoteResponse:
    toss_symbol = to_toss_symbol(symbol)
    stocks = get_stocks([toss_symbol])
    prices = get_prices([toss_symbol])

    stock = stocks[0] if stocks else {}
    price_row = prices[0] if prices else {}
    price = _price_value(price_row)
    if price is None:
        raise TossApiError("시세 조회 실패")

    app_symbol = to_app_symbol(price_row.get("symbol") or toss_symbol, _stock_market(stock))
    currency = price_row.get("currency") or stock.get("currency") or "KRW"
    return MarketQuoteResponse(
        symbol=app_symbol,
        name=_stock_name(stock),
        price=price,
        currency=currency,
        updated_at=datetime.utcnow(),
    )


def search_symbols(query: str) -> list[MarketSearchItem]:
    cleaned = query.strip().upper().rstrip(".")
    match = KOREAN_SYMBOL_RE.match(cleaned)
    if match:
        symbol = match.group(1)
    else:
        symbol = cleaned.split(".")[0]
    if not symbol or not re.fullmatch(r"[A-Z0-9.\-]+", symbol):
        return []

    item = lookup_symbol(symbol)
    return [item] if item else []


def verify_connection() -> None:
    get_prices(["005930"])


def clear_token_cache() -> None:
    with _token_cache["lock"]:
        _token_cache["token"] = None
        _token_cache["expires_at"] = datetime.min
