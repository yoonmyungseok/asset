from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.external.market_data import RateLimitError, get_quote
from app.models import Account, Holding
from app.schemas.account import (
    HoldingCreate,
    HoldingResponse,
    HoldingUpdate,
    RefreshPricesRequest,
    RefreshPricesResponse,
)
from app.services.core import holding_to_response, remove_holding
from app.utils import (
    ASSET_CLASS_DEPOSIT,
    generate_deposit_symbol,
    is_deposit_holding,
    normalize_deposit_holding,
)

router = APIRouter(prefix="/holdings", tags=["holdings"])


def _apply_market_quote(holding: Holding) -> None:
    if is_deposit_holding(holding):
        return
    try:
        quote = get_quote(holding.symbol)
    except (ValueError, RateLimitError):
        return
    holding.last_market_price = quote.price
    holding.last_price_updated_at = datetime.utcnow()
    if quote.name:
        holding.name = quote.name


def _prepare_holding_fields(payload: HoldingCreate) -> dict:
    asset_class = payload.asset_class
    if asset_class == ASSET_CLASS_DEPOSIT:
        return {
            "asset_class": asset_class,
            "symbol": payload.symbol or generate_deposit_symbol(),
            "name": payload.name,
            "quantity": payload.quantity,
            "avg_cost_price": payload.avg_cost_price,
            "manual_price": payload.avg_cost_price,
            "interest_rate": payload.interest_rate,
            "start_date": payload.start_date or date.today(),
            "maturity_date": payload.maturity_date,
        }
    return {
        "asset_class": asset_class,
        "symbol": payload.symbol,
        "name": payload.name,
        "quantity": payload.quantity,
        "avg_cost_price": payload.avg_cost_price,
        "manual_price": None,
        "interest_rate": None,
        "start_date": None,
        "maturity_date": None,
    }


@router.get("", response_model=list[HoldingResponse])
def list_holdings(account_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Holding).options(joinedload(Holding.account)).filter(Holding.quantity > 0)
    if account_id:
        query = query.filter(Holding.account_id == account_id)
    holdings = query.order_by(Holding.id).all()
    return [holding_to_response(h, h.account.name if h.account else None) for h in holdings]


@router.post("", response_model=HoldingResponse, status_code=201)
def create_holding(payload: HoldingCreate, db: Session = Depends(get_db)):
    account = db.get(Account, payload.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    if not account.account_type.supports_holdings:
        raise HTTPException(status_code=400, detail="이 계좌 유형은 보유 종목을 지원하지 않습니다.")

    fields = _prepare_holding_fields(payload)
    holding = Holding(account_id=payload.account_id, **fields)
    if is_deposit_holding(holding):
        normalize_deposit_holding(holding)
    db.add(holding)
    db.flush()
    _apply_market_quote(holding)
    db.commit()
    db.refresh(holding)
    holding = db.query(Holding).options(joinedload(Holding.account)).filter(Holding.id == holding.id).first()
    return holding_to_response(holding, holding.account.name)


@router.patch("/{holding_id}", response_model=HoldingResponse)
def update_holding(holding_id: int, payload: HoldingUpdate, db: Session = Depends(get_db)):
    holding = db.query(Holding).options(joinedload(Holding.account)).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="보유 종목을 찾을 수 없습니다.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(holding, key, value)
    if is_deposit_holding(holding):
        normalize_deposit_holding(holding)
    db.commit()
    db.refresh(holding)
    return holding_to_response(holding, holding.account.name)


@router.delete("/{holding_id}", status_code=204)
def delete_holding(holding_id: int, db: Session = Depends(get_db)):
    holding = db.get(Holding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="보유 종목을 찾을 수 없습니다.")
    remove_holding(db, holding)
    db.commit()


@router.post("/refresh-prices", response_model=RefreshPricesResponse)
def refresh_prices(payload: RefreshPricesRequest | None = None, db: Session = Depends(get_db)):
    query = db.query(Holding).filter(Holding.quantity > 0, Holding.asset_class != ASSET_CLASS_DEPOSIT)
    if payload and payload.holding_ids:
        query = query.filter(Holding.id.in_(payload.holding_ids))
    holdings = query.all()
    updated = 0
    failed: list[dict] = []
    for holding in holdings:
        try:
            quote = get_quote(holding.symbol)
            holding.last_market_price = quote.price
            holding.last_price_updated_at = datetime.utcnow()
            if quote.name:
                holding.name = quote.name
            updated += 1
        except RateLimitError:
            failed.append(
                {"holding_id": holding.id, "symbol": holding.symbol, "reason": "시세 서버 요청 한도 초과"}
            )
            break
        except ValueError:
            failed.append(
                {"holding_id": holding.id, "symbol": holding.symbol, "reason": "시세 조회 실패"}
            )
    db.commit()
    return RefreshPricesResponse(updated=updated, failed=failed)
