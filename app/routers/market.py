from fastapi import APIRouter, HTTPException, Query

from app.config import clear_toss_credentials, save_toss_credentials
from app.external import toss_invest
from app.external.market_data import RateLimitError, get_quote, search_symbols
from app.schemas.system import (
    MarketProviderStatus,
    MarketQuoteResponse,
    MarketSearchItem,
    TossCredentialsUpdate,
)

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/status", response_model=MarketProviderStatus)
def market_status():
    configured = toss_invest.is_toss_configured()
    if not configured:
        return MarketProviderStatus(
            provider="fallback",
            configured=False,
            connected=False,
            message="토스증권 API 미설정. 네이버/야후 폴백을 사용 중입니다.",
        )

    try:
        toss_invest.verify_connection()
        return MarketProviderStatus(
            provider="toss",
            configured=True,
            connected=True,
            message="토스증권 API 연결됨",
        )
    except toss_invest.TossRateLimitError as exc:
        return MarketProviderStatus(
            provider="toss",
            configured=True,
            connected=False,
            message=str(exc),
        )
    except toss_invest.TossApiError as exc:
        return MarketProviderStatus(
            provider="toss",
            configured=True,
            connected=False,
            message=str(exc),
        )


@router.put("/credentials", response_model=MarketProviderStatus)
def save_market_credentials(payload: TossCredentialsUpdate):
    if not payload.client_id.strip() or not payload.client_secret.strip():
        raise HTTPException(status_code=400, detail="Client ID와 Secret을 입력하세요.")
    save_toss_credentials(payload.client_id.strip(), payload.client_secret.strip())
    toss_invest.clear_token_cache()
    return market_status()


@router.delete("/credentials", response_model=MarketProviderStatus)
def delete_market_credentials():
    clear_toss_credentials()
    toss_invest.clear_token_cache()
    return market_status()


@router.get("/quote/{symbol}", response_model=MarketQuoteResponse)
def market_quote(symbol: str):
    try:
        return get_quote(symbol)
    except RateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/search", response_model=list[MarketSearchItem])
def market_search(q: str = Query(..., min_length=1)):
    try:
        return search_symbols(q)
    except RateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except toss_invest.TossApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
