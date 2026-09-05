from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Account, Holding, InvestmentTransaction, LedgerTransaction
from app.schemas.account import (
    InvestmentTransactionCreate,
    InvestmentTransactionResponse,
    InvestmentTransactionUpdate,
)
from app.schemas.account import PaginatedResponse
from app.services.core import apply_buy, apply_sell, remove_holding, update_contributed_amount
from app.utils import (
    ASSET_CLASS_DEPOSIT,
    generate_deposit_symbol,
    holding_accrued_interest,
    is_deposit_holding,
    normalize_deposit_holding,
    to_decimal as dec,
)

router = APIRouter(prefix="/investment-transactions", tags=["investment-transactions"])


def _paginate(query, page: int, page_size: int):
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return items, total, total_pages


@router.get("", response_model=PaginatedResponse[InvestmentTransactionResponse])
def list_investment_transactions(
    account_id: int | None = None,
    holding_id: int | None = None,
    type: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    sort_order: str = "desc",
    db: Session = Depends(get_db),
):
    query = db.query(InvestmentTransaction)
    if account_id:
        query = query.filter(InvestmentTransaction.account_id == account_id)
    if holding_id:
        query = query.filter(InvestmentTransaction.holding_id == holding_id)
    if type:
        query = query.filter(InvestmentTransaction.type == type)
    if from_date:
        query = query.filter(InvestmentTransaction.transaction_date >= from_date)
    if to_date:
        query = query.filter(InvestmentTransaction.transaction_date <= to_date)
    if sort_order == "asc":
        query = query.order_by(InvestmentTransaction.transaction_date.asc(), InvestmentTransaction.id.asc())
    else:
        query = query.order_by(InvestmentTransaction.transaction_date.desc(), InvestmentTransaction.id.desc())
    items, total, total_pages = _paginate(query, page, page_size)
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{transaction_id}", response_model=InvestmentTransactionResponse)
def get_investment_transaction(transaction_id: int, db: Session = Depends(get_db)):
    tx = db.get(InvestmentTransaction, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다.")
    return tx


def _resolve_holding(db: Session, account: Account, payload: InvestmentTransactionCreate) -> Holding:
    if payload.holding_id:
        holding = db.get(Holding, payload.holding_id)
        if not holding or holding.account_id != account.id:
            raise HTTPException(status_code=400, detail="유효하지 않은 보유 종목입니다.")
        return holding

    asset_class = payload.asset_class or "stock"

    if asset_class == ASSET_CLASS_DEPOSIT:
        if not payload.name:
            raise HTTPException(status_code=400, detail="예금 상품명이 필요합니다.")
        holding = (
            db.query(Holding)
            .filter(
                Holding.account_id == account.id,
                Holding.asset_class == ASSET_CLASS_DEPOSIT,
                Holding.name == payload.name,
            )
            .first()
        )
        if not holding:
            holding = Holding(
                account_id=account.id,
                asset_class=ASSET_CLASS_DEPOSIT,
                symbol=payload.symbol or generate_deposit_symbol(),
                name=payload.name,
                quantity=0,
                avg_cost_price=Decimal("1"),
                manual_price=Decimal("1"),
            )
            db.add(holding)
            db.flush()
        return holding

    if not payload.symbol or not payload.name:
        raise HTTPException(status_code=400, detail="symbol과 name이 필요합니다.")
    holding = (
        db.query(Holding)
        .filter(Holding.account_id == account.id, Holding.symbol == payload.symbol)
        .first()
    )
    if not holding:
        holding = Holding(
            account_id=account.id,
            asset_class="stock",
            symbol=payload.symbol,
            name=payload.name,
            quantity=0,
            avg_cost_price=0,
        )
        db.add(holding)
        db.flush()
    return holding


def _apply_transaction_effects(db: Session, account: Account, holding: Holding | None, tx: InvestmentTransaction):
    amount = dec(tx.amount)
    fee = dec(tx.fee)
    if tx.type == "buy":
        if not holding:
            raise HTTPException(status_code=400, detail="매수 거래에는 보유 종목이 필요합니다.")
        if is_deposit_holding(holding):
            quantity = dec(tx.quantity) if tx.quantity else amount
            price = Decimal("1")
            normalize_deposit_holding(holding)
            apply_buy(holding, quantity, price)
        else:
            quantity = dec(tx.quantity)
            price = dec(tx.price)
            apply_buy(holding, quantity, price)
        account.cash_balance = dec(account.cash_balance) - amount - fee
    elif tx.type == "sell":
        if not holding:
            raise HTTPException(status_code=400, detail="매도 거래에는 보유 종목이 필요합니다.")
        sell_qty = dec(tx.quantity) if tx.quantity else amount
        apply_sell(holding, sell_qty)
        account.cash_balance = dec(account.cash_balance) + amount - fee
        if dec(holding.quantity) <= 0:
            tx.holding_id = None
            remove_holding(db, holding)
    elif tx.type == "deposit":
        account.cash_balance = dec(account.cash_balance) + amount
    elif tx.type in ("withdraw", "fee"):
        account.cash_balance = dec(account.cash_balance) - amount
    elif tx.type in ("dividend", "interest"):
        if holding and is_deposit_holding(holding) and tx.type == "interest":
            normalize_deposit_holding(holding)
            apply_buy(holding, amount, Decimal("1"))
            holding.start_date = tx.transaction_date
        else:
            account.cash_balance = dec(account.cash_balance) + amount
    update_contributed_amount(db, account.id, tx.transaction_date.year)


def _reverse_transaction_effects(db: Session, account: Account, tx: InvestmentTransaction):
    amount = dec(tx.amount)
    fee = dec(tx.fee)
    if tx.type == "buy":
        account.cash_balance = dec(account.cash_balance) + amount + fee
    elif tx.type == "sell":
        account.cash_balance = dec(account.cash_balance) - amount + fee
    elif tx.type == "deposit":
        account.cash_balance = dec(account.cash_balance) - amount
    elif tx.type in ("withdraw", "fee"):
        account.cash_balance = dec(account.cash_balance) + amount
    elif tx.type in ("dividend", "interest"):
        holding = db.get(Holding, tx.holding_id) if tx.holding_id else None
        if holding and is_deposit_holding(holding) and tx.type == "interest":
            apply_sell(holding, amount)
        else:
            account.cash_balance = dec(account.cash_balance) - amount


@router.post("", response_model=InvestmentTransactionResponse, status_code=201)
def create_investment_transaction(payload: InvestmentTransactionCreate, db: Session = Depends(get_db)):
    account = db.get(Account, payload.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")

    holding = None
    if payload.type in ("buy", "sell"):
        holding = _resolve_holding(db, account, payload)
    elif payload.holding_id:
        holding = db.get(Holding, payload.holding_id)
        if not holding or holding.account_id != account.id:
            raise HTTPException(status_code=400, detail="유효하지 않은 보유 종목입니다.")

    tx = InvestmentTransaction(
        account_id=payload.account_id,
        holding_id=holding.id if holding else None,
        type=payload.type,
        transaction_date=payload.transaction_date,
        quantity=payload.quantity,
        price=payload.price,
        amount=payload.amount,
        fee=payload.fee,
        memo=payload.memo,
    )
    db.add(tx)
    db.flush()
    _apply_transaction_effects(db, account, holding, tx)

    if payload.sync_to_ledger and payload.type in ("dividend", "interest"):
        if not payload.ledger_category_id:
            raise HTTPException(status_code=400, detail="가계부 연동 시 ledger_category_id가 필요합니다.")
        ledger_tx = LedgerTransaction(
            transaction_date=payload.transaction_date,
            type="income",
            amount=payload.amount,
            category_id=payload.ledger_category_id,
            merchant=holding.name if holding else account.name,
            memo=payload.memo or f"투자 {payload.type}",
        )
        db.add(ledger_tx)

    db.commit()
    db.refresh(tx)
    return tx


@router.patch("/{transaction_id}", response_model=InvestmentTransactionResponse)
def update_investment_transaction(
    transaction_id: int,
    payload: InvestmentTransactionUpdate,
    db: Session = Depends(get_db),
):
    tx = db.get(InvestmentTransaction, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(tx, key, value)
    db.commit()
    db.refresh(tx)
    update_contributed_amount(db, tx.account_id, tx.transaction_date.year)
    return tx


@router.delete("/{transaction_id}", status_code=204)
def delete_investment_transaction(transaction_id: int, db: Session = Depends(get_db)):
    tx = db.get(InvestmentTransaction, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다.")
    account = db.get(Account, tx.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    account_id = tx.account_id
    year = tx.transaction_date.year
    _reverse_transaction_effects(db, account, tx)
    db.delete(tx)
    db.commit()
    update_contributed_amount(db, account_id, year)
