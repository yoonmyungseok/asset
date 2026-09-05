from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import LedgerTransaction, RecurringItem
from app.schemas.ledger import (
    RecurringGenerateItem,
    RecurringGenerateRequest,
    RecurringGenerateResponse,
    RecurringItemCreate,
    RecurringItemResponse,
    RecurringItemUpdate,
)

router = APIRouter(prefix="/recurring-items", tags=["recurring-items"])


@router.get("", response_model=list[RecurringItemResponse])
def list_recurring_items(db: Session = Depends(get_db)):
    return db.query(RecurringItem).order_by(RecurringItem.id).all()


@router.post("", response_model=RecurringItemResponse, status_code=201)
def create_recurring_item(payload: RecurringItemCreate, db: Session = Depends(get_db)):
    item = RecurringItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=RecurringItemResponse)
def update_recurring_item(item_id: int, payload: RecurringItemUpdate, db: Session = Depends(get_db)):
    item = db.get(RecurringItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="정기 항목을 찾을 수 없습니다.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_recurring_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(RecurringItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="정기 항목을 찾을 수 없습니다.")
    db.delete(item)
    db.commit()


@router.post("/generate", response_model=RecurringGenerateResponse)
def generate_recurring_items(payload: RecurringGenerateRequest, db: Session = Depends(get_db)):
    items = db.query(RecurringItem).filter(RecurringItem.is_active.is_(True)).all()
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
