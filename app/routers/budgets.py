from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Budget, Category
from app.schemas.ledger import BudgetAlertsResponse, BudgetAlertItem, BudgetResponse, BudgetUpsert
from app.services.core import calculate_budget_spent
from app.utils import to_decimal

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _budget_response(db: Session, budget: Budget) -> BudgetResponse:
    spent = calculate_budget_spent(db, budget.category_id, budget.year, budget.month)
    amount = to_decimal(budget.amount)
    remaining = amount - spent
    usage_rate = (spent / amount * 100) if amount > 0 else Decimal("0")
    return BudgetResponse(
        id=budget.id,
        category_id=budget.category_id,
        category_name=budget.category.name if budget.category else "",
        year=budget.year,
        month=budget.month,
        amount=amount,
        spent=spent,
        remaining=remaining,
        usage_rate=usage_rate.quantize(Decimal("0.01")),
        over_budget=spent > amount,
    )


@router.get("", response_model=list[BudgetResponse])
def list_budgets(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    budgets = (
        db.query(Budget)
        .options(joinedload(Budget.category))
        .filter(Budget.year == year, Budget.month == month)
        .all()
    )
    return [_budget_response(db, budget) for budget in budgets]


@router.put("", response_model=BudgetResponse)
def upsert_budget(payload: BudgetUpsert, db: Session = Depends(get_db)):
    category = db.get(Category, payload.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    budget = (
        db.query(Budget)
        .options(joinedload(Budget.category))
        .filter(
            Budget.category_id == payload.category_id,
            Budget.year == payload.year,
            Budget.month == payload.month,
        )
        .first()
    )
    if not budget:
        budget = Budget(
            category_id=payload.category_id,
            year=payload.year,
            month=payload.month,
            amount=payload.amount,
        )
        db.add(budget)
    else:
        budget.amount = payload.amount
    db.commit()
    budget = (
        db.query(Budget)
        .options(joinedload(Budget.category))
        .filter(Budget.id == budget.id)
        .first()
    )
    return _budget_response(db, budget)


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="예산을 찾을 수 없습니다.")
    db.delete(budget)
    db.commit()


@router.get("/alerts", response_model=BudgetAlertsResponse)
def budget_alerts(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    budgets = (
        db.query(Budget)
        .options(joinedload(Budget.category))
        .filter(Budget.year == year, Budget.month == month)
        .all()
    )
    over_budget: list[BudgetAlertItem] = []
    near_limit: list[BudgetAlertItem] = []
    for budget in budgets:
        spent = calculate_budget_spent(db, budget.category_id, year, month)
        amount = to_decimal(budget.amount)
        usage_rate = (spent / amount * 100) if amount > 0 else Decimal("0")
        if spent > amount:
            over_budget.append(
                BudgetAlertItem(
                    category_name=budget.category.name,
                    budget=amount,
                    spent=spent,
                    over_amount=spent - amount,
                )
            )
        elif usage_rate >= 90:
            near_limit.append(
                BudgetAlertItem(
                    category_name=budget.category.name,
                    budget=amount,
                    spent=spent,
                    usage_rate=usage_rate.quantize(Decimal("0.01")),
                )
            )
    return BudgetAlertsResponse(over_budget=over_budget, near_limit=near_limit)
