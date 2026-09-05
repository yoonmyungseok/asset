from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Liability, LiabilityTransaction
from app.schemas.liability import (
    LiabilityCreate,
    LiabilityResponse,
    LiabilityTransactionCreate,
    LiabilityTransactionResponse,
    LiabilityUpdate,
)
from app.utils import to_decimal

router = APIRouter(prefix="/liabilities", tags=["liabilities"])


@router.get("", response_model=list[LiabilityResponse])
def list_liabilities(
    type: str | None = None,
    is_active: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(Liability)
    if is_active is not None:
        query = query.filter(Liability.is_active == is_active)
    if type:
        query = query.filter(Liability.type == type)
    return query.order_by(Liability.id).all()


@router.post("", response_model=LiabilityResponse, status_code=201)
def create_liability(payload: LiabilityCreate, db: Session = Depends(get_db)):
    liability = Liability(**payload.model_dump())
    db.add(liability)
    db.commit()
    db.refresh(liability)
    return liability


@router.patch("/{liability_id}", response_model=LiabilityResponse)
def update_liability(liability_id: int, payload: LiabilityUpdate, db: Session = Depends(get_db)):
    liability = db.get(Liability, liability_id)
    if not liability:
        raise HTTPException(status_code=404, detail="부채를 찾을 수 없습니다.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(liability, key, value)
    db.commit()
    db.refresh(liability)
    return liability


@router.delete("/{liability_id}", status_code=204)
def delete_liability(liability_id: int, db: Session = Depends(get_db)):
    liability = db.get(Liability, liability_id)
    if not liability:
        raise HTTPException(status_code=404, detail="부채를 찾을 수 없습니다.")
    db.delete(liability)
    db.commit()


@router.get("/{liability_id}/transactions", response_model=list[LiabilityTransactionResponse])
def list_liability_transactions(liability_id: int, db: Session = Depends(get_db)):
    liability = db.get(Liability, liability_id)
    if not liability:
        raise HTTPException(status_code=404, detail="부채를 찾을 수 없습니다.")
    return (
        db.query(LiabilityTransaction)
        .filter(LiabilityTransaction.liability_id == liability_id)
        .order_by(LiabilityTransaction.transaction_date.desc())
        .all()
    )


@router.post("/{liability_id}/transactions", response_model=LiabilityTransactionResponse, status_code=201)
def create_liability_transaction(
    liability_id: int,
    payload: LiabilityTransactionCreate,
    db: Session = Depends(get_db),
):
    liability = db.get(Liability, liability_id)
    if not liability:
        raise HTTPException(status_code=404, detail="부채를 찾을 수 없습니다.")
    tx = LiabilityTransaction(
        liability_id=liability_id,
        transaction_date=payload.transaction_date,
        type=payload.type,
        amount=payload.amount,
        memo=payload.memo,
    )
    if payload.type == "payment":
        liability.current_balance = to_decimal(liability.current_balance) - to_decimal(payload.amount)
    elif payload.type in ("charge", "interest"):
        liability.current_balance = to_decimal(liability.current_balance) + to_decimal(payload.amount)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx
