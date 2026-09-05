from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Account, AccountType, AccountYearlyLimit, Holding, InvestmentTransaction
from app.schemas.account import AccountCreate, AccountResponse, AccountUpdate
from app.services.core import account_to_response, serialize_account_metadata

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
def list_accounts(
    category: str | None = None,
    account_type_id: int | None = None,
    is_active: bool = True,
    include_summary: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    query = db.query(Account).options(joinedload(Account.account_type))
    if is_active is not None:
        query = query.filter(Account.is_active == is_active)
    if account_type_id:
        query = query.filter(Account.account_type_id == account_type_id)
    if category:
        query = query.join(AccountType).filter(AccountType.category == category)
    accounts = query.order_by(Account.id).all()
    return [account_to_response(db, account, include_summary) for account in accounts]


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = (
        db.query(Account)
        .options(joinedload(Account.account_type))
        .filter(Account.id == account_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    return account_to_response(db, account, include_summary=True)


@router.post("", response_model=AccountResponse, status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)):
    account_type = db.get(AccountType, payload.account_type_id)
    if not account_type:
        raise HTTPException(status_code=404, detail="계좌 유형을 찾을 수 없습니다.")
    account = Account(
        account_type_id=payload.account_type_id,
        name=payload.name,
        institution=payload.institution,
        cash_balance=payload.cash_balance,
        metadata_json=serialize_account_metadata(payload.metadata),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    account = (
        db.query(Account)
        .options(joinedload(Account.account_type))
        .filter(Account.id == account.id)
        .first()
    )
    return account_to_response(db, account)


@router.patch("/{account_id}", response_model=AccountResponse)
def update_account(account_id: int, payload: AccountUpdate, db: Session = Depends(get_db)):
    account = (
        db.query(Account)
        .options(joinedload(Account.account_type))
        .filter(Account.id == account_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    data = payload.model_dump(exclude_unset=True)
    metadata = data.pop("metadata", None)
    account_type_id = data.pop("account_type_id", None)
    if account_type_id is not None:
        account_type = db.get(AccountType, account_type_id)
        if not account_type:
            raise HTTPException(status_code=404, detail="계좌 유형을 찾을 수 없습니다.")
        account.account_type_id = account_type_id
    for key, value in data.items():
        setattr(account, key, value)
    if metadata is not None:
        account.metadata_json = serialize_account_metadata(metadata)
    db.commit()
    db.refresh(account)
    return account_to_response(db, account)


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    has_data = (
        db.query(Holding).filter(Holding.account_id == account_id).first()
        or db.query(InvestmentTransaction).filter(InvestmentTransaction.account_id == account_id).first()
    )
    if has_data:
        raise HTTPException(status_code=400, detail="연관 데이터가 있어 삭제할 수 없습니다. 비활성화를 사용하세요.")
    db.delete(account)
    db.commit()


@router.post("/{account_id}/deactivate", response_model=AccountResponse)
def deactivate_account(account_id: int, db: Session = Depends(get_db)):
    account = (
        db.query(Account)
        .options(joinedload(Account.account_type))
        .filter(Account.id == account_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    account.is_active = False
    db.query(AccountYearlyLimit).filter(AccountYearlyLimit.account_id == account_id).delete()
    db.commit()
    db.refresh(account)
    return account_to_response(db, account)
