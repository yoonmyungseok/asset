from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Category, LedgerTransaction, RecurringItem
from app.schemas.card import CardBrief
from app.schemas.ledger import (
    CategoryBrief,
    PaymentMethodBrief,
    RecurringGenerateItem,
    RecurringGenerateRequest,
    RecurringGenerateResponse,
    RecurringItemCreate,
    RecurringItemResponse,
    RecurringItemUpdate,
)

router = APIRouter(prefix="/recurring-items", tags=["recurring-items"])


def _recurring_item_query(db: Session):
    return db.query(RecurringItem).options(
        joinedload(RecurringItem.category).joinedload(Category.parent),
        joinedload(RecurringItem.payment_method),
        joinedload(RecurringItem.account),
        joinedload(RecurringItem.to_account),
        joinedload(RecurringItem.card),
    )


def _serialize_recurring_item(item: RecurringItem) -> RecurringItemResponse:
    parent_name = item.category.parent.name if item.category and item.category.parent else None
    card_brief = None
    if item.card:
        card_brief = CardBrief(
            id=item.card.id,
            name=item.card.name,
            card_type=item.card.card_type,
            institution=item.card.institution,
            last_four=item.card.last_four,
        )
    return RecurringItemResponse(
        id=item.id,
        type=item.type,
        amount=item.amount,
        category=CategoryBrief(
            id=item.category.id,
            name=item.category.name,
            parent_name=parent_name,
        ),
        payment_method=PaymentMethodBrief(id=item.payment_method.id, name=item.payment_method.name)
        if item.payment_method
        else None,
        account_id=item.account_id,
        to_account_id=item.to_account_id,
        account_name=item.account.name if item.account else None,
        to_account_name=item.to_account.name if item.to_account else None,
        card=card_brief,
        merchant=item.merchant,
        memo=item.memo,
        frequency=item.frequency,
        day_of_month=item.day_of_month,
        is_active=item.is_active,
    )


@router.get("", response_model=list[RecurringItemResponse])
def list_recurring_items(db: Session = Depends(get_db)):
    items = _recurring_item_query(db).order_by(RecurringItem.id).all()
    return [_serialize_recurring_item(item) for item in items]


@router.post("", response_model=RecurringItemResponse, status_code=201)
def create_recurring_item(payload: RecurringItemCreate, db: Session = Depends(get_db)):
    item = RecurringItem(**payload.model_dump())
    db.add(item)
    db.commit()
    item = _recurring_item_query(db).filter(RecurringItem.id == item.id).one()
    return _serialize_recurring_item(item)


@router.patch("/{item_id}", response_model=RecurringItemResponse)
def update_recurring_item(item_id: int, payload: RecurringItemUpdate, db: Session = Depends(get_db)):
    item = db.get(RecurringItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="정기 항목을 찾을 수 없습니다.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    item = _recurring_item_query(db).filter(RecurringItem.id == item.id).one()
    return _serialize_recurring_item(item)


@router.delete("/{item_id}", status_code=204)
def delete_recurring_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(RecurringItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="정기 항목을 찾을 수 없습니다.")
    db.delete(item)
    db.commit()


@router.post("/generate", response_model=RecurringGenerateResponse)
def generate_recurring_items(payload: RecurringGenerateRequest, db: Session = Depends(get_db)):
    items = _recurring_item_query(db).filter(RecurringItem.is_active.is_(True)).all()
    generated = 0
    skipped = 0
    results: list[RecurringGenerateItem] = []

    for item in items:
        exists = (
            db.query(LedgerTransaction)
            .filter(
                LedgerTransaction.type == item.type,
                LedgerTransaction.category_id == item.category_id,
                LedgerTransaction.amount == item.amount,
                func.strftime("%Y", LedgerTransaction.transaction_date) == str(payload.year),
                func.strftime("%m", LedgerTransaction.transaction_date) == f"{payload.month:02d}",
                LedgerTransaction.memo == (item.memo or f"정기 {item.type}"),
            )
            .first()
        )
        if exists:
            skipped += 1
            results.append(RecurringGenerateItem(recurring_item_id=item.id, status="already_exists"))
            continue

        day = min(item.day_of_month, 28)
        tx_date = date(payload.year, payload.month, day)
        tx = LedgerTransaction(
            transaction_date=tx_date,
            type=item.type,
            amount=item.amount,
            category_id=item.category_id,
            payment_method_id=item.payment_method_id,
            account_id=item.account_id,
            to_account_id=item.to_account_id,
            card_id=item.card_id,
            merchant=item.merchant,
            memo=item.memo or f"정기 {item.type}",
            is_fixed=True,
        )
        db.add(tx)
        db.flush()
        generated += 1
        results.append(
            RecurringGenerateItem(
                recurring_item_id=item.id,
                ledger_transaction_id=tx.id,
                status="created",
            )
        )

    db.commit()
    return RecurringGenerateResponse(generated=generated, skipped=skipped, items=results)
