from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AccountType
from app.schemas.account import AccountTypeCreate, AccountTypeResponse

router = APIRouter(prefix="/account-types", tags=["account-types"])


@router.get("", response_model=list[AccountTypeResponse])
def list_account_types(db: Session = Depends(get_db)):
    return (
        db.query(AccountType)
        .order_by(AccountType.sort_order, AccountType.id)
        .all()
    )


@router.post("", response_model=AccountTypeResponse, status_code=201)
def create_account_type(payload: AccountTypeCreate, db: Session = Depends(get_db)):
    exists = db.query(AccountType).filter(AccountType.code == payload.code).first()
    if exists:
        raise HTTPException(status_code=400, detail="이미 존재하는 계좌 유형 코드입니다.")
    account_type = AccountType(
        code=payload.code,
        name=payload.name,
        category=payload.category,
        supports_holdings=payload.supports_holdings,
        supports_contribution_limit=payload.supports_contribution_limit,
        sort_order=payload.sort_order,
        is_system=False,
    )
    db.add(account_type)
    db.commit()
    db.refresh(account_type)
    return account_type
