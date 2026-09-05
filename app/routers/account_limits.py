from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Account, AccountYearlyLimit
from app.schemas.account import AccountLimitResponse, AccountLimitUpsert
from app.utils import to_decimal

router = APIRouter(prefix="/account-limits", tags=["account-limits"])


@router.get("", response_model=list[AccountLimitResponse])
def list_account_limits(
    account_id: int | None = None,
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    from datetime import date

    target_year = year or date.today().year
    query = (
        db.query(AccountYearlyLimit)
        .join(Account)
        .options(joinedload(AccountYearlyLimit.account))
        .filter(AccountYearlyLimit.year == target_year, Account.is_active.is_(True))
    )
    if account_id:
        query = query.filter(AccountYearlyLimit.account_id == account_id)
    limits = query.all()
    results = []
    for limit in limits:
        contribution_limit = to_decimal(limit.contribution_limit)
        contributed = to_decimal(limit.contributed_amount)
        remaining = contribution_limit - contributed
        usage_rate = (contributed / contribution_limit * 100) if contribution_limit > 0 else Decimal("0")
        results.append(
            AccountLimitResponse(
                id=limit.id,
                account_id=limit.account_id,
                account_name=limit.account.name if limit.account else None,
                year=limit.year,
                contribution_limit=contribution_limit,
                contributed_amount=contributed,
                remaining_amount=remaining,
                usage_rate=usage_rate.quantize(Decimal("0.01")),
            )
        )
    return results


@router.put("", response_model=AccountLimitResponse)
def upsert_account_limit(payload: AccountLimitUpsert, db: Session = Depends(get_db)):
    account = db.get(Account, payload.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
    limit = (
        db.query(AccountYearlyLimit)
        .filter(
            AccountYearlyLimit.account_id == payload.account_id,
            AccountYearlyLimit.year == payload.year,
        )
        .first()
    )
    if not limit:
        limit = AccountYearlyLimit(
            account_id=payload.account_id,
            year=payload.year,
            contribution_limit=payload.contribution_limit,
        )
        db.add(limit)
    else:
        limit.contribution_limit = payload.contribution_limit
    db.commit()
    db.refresh(limit)
    contribution_limit = to_decimal(limit.contribution_limit)
    contributed = to_decimal(limit.contributed_amount)
    remaining = contribution_limit - contributed
    usage_rate = (contributed / contribution_limit * 100) if contribution_limit > 0 else Decimal("0")
    return AccountLimitResponse(
        id=limit.id,
        account_id=limit.account_id,
        account_name=account.name,
        year=limit.year,
        contribution_limit=contribution_limit,
        contributed_amount=contributed,
        remaining_amount=remaining,
        usage_rate=usage_rate.quantize(Decimal("0.01")),
    )


@router.delete("/{limit_id}", status_code=204)
def delete_account_limit(limit_id: int, db: Session = Depends(get_db)):
    limit = db.get(AccountYearlyLimit, limit_id)
    if not limit:
        raise HTTPException(status_code=404, detail="한도 정보를 찾을 수 없습니다.")
    db.delete(limit)
    db.commit()
