from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import LedgerTransaction, PaymentMethod
from app.schemas.ledger import PaymentMethodCreate, PaymentMethodResponse

router = APIRouter(prefix="/payment-methods", tags=["payment-methods"])


@router.get("", response_model=list[PaymentMethodResponse])
def list_payment_methods(db: Session = Depends(get_db)):
    return db.query(PaymentMethod).order_by(PaymentMethod.id).all()


@router.post("", response_model=PaymentMethodResponse, status_code=201)
def create_payment_method(payload: PaymentMethodCreate, db: Session = Depends(get_db)):
    exists = db.query(PaymentMethod).filter(PaymentMethod.name == payload.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="이미 존재하는 결제 수단입니다.")
    method = PaymentMethod(name=payload.name, is_system=False)
    db.add(method)
    db.commit()
    db.refresh(method)
    return method


@router.delete("/{method_id}", status_code=204)
def delete_payment_method(method_id: int, db: Session = Depends(get_db)):
    method = db.get(PaymentMethod, method_id)
    if not method:
        raise HTTPException(status_code=404, detail="결제 수단을 찾을 수 없습니다.")
    if method.is_system:
        raise HTTPException(status_code=400, detail="시스템 기본 결제 수단은 삭제할 수 없습니다.")
    in_use = db.query(LedgerTransaction).filter(LedgerTransaction.payment_method_id == method_id).first()
    if in_use:
        raise HTTPException(status_code=400, detail="사용 중인 결제 수단은 삭제할 수 없습니다.")
    db.delete(method)
    db.commit()
