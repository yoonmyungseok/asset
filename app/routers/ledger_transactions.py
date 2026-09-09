from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Budget, Card, Category, LedgerTransaction, PaymentMethod, Tag
from app.schemas.account import PaginatedResponse
from app.schemas.card import CardBrief
from app.schemas.ledger import (
    CategoryBrief,
    LedgerSummaryCard,
    LedgerSummaryCategory,
    LedgerSummaryComparison,
    LedgerSummaryResponse,
    LedgerTransactionCreate,
    LedgerTransactionResponse,
    LedgerTransactionUpdate,
    PaymentMethodBrief,
)
from app.services.bank_transfers import (
    apply_ledger_balance_effects,
    get_internal_transfer_category,
    get_reimbursement_in_category,
    get_reimbursement_out_category,
    is_bank_transfer_method,
    reverse_ledger_balance_effects,
    validate_account_for_transfer,
)
from app.services.card_payments import (
    resolve_account_id_for_card,
    validate_card_for_expense,
)
from app.services.core import get_category_descendant_ids, get_or_create_tag

router = APIRouter(prefix="/ledger-transactions", tags=["ledger-transactions"])


def _serialize_ledger_tx(tx: LedgerTransaction) -> LedgerTransactionResponse:
    parent_name = tx.category.parent.name if tx.category and tx.category.parent else None
    card_brief = None
    if tx.card:
        card_brief = CardBrief(
            id=tx.card.id,
            name=tx.card.name,
            card_type=tx.card.card_type,
            institution=tx.card.institution,
            last_four=tx.card.last_four,
        )
    return LedgerTransactionResponse(
        id=tx.id,
        transaction_date=tx.transaction_date,
        type=tx.type,
        amount=tx.amount,
        category=CategoryBrief(id=tx.category.id, name=tx.category.name, parent_name=parent_name),
        payment_method=PaymentMethodBrief(id=tx.payment_method.id, name=tx.payment_method.name)
        if tx.payment_method
        else None,
        account_id=tx.account_id,
        to_account_id=tx.to_account_id,
        account_name=tx.account.name if tx.account else None,
        to_account_name=tx.to_account.name if tx.to_account else None,
        card=card_brief,
        merchant=tx.merchant,
        memo=tx.memo,
        is_fixed=tx.is_fixed,
        tags=[tag.name for tag in tx.tags],
    )


def _ledger_tx_query(db: Session):
    return db.query(LedgerTransaction).options(
        joinedload(LedgerTransaction.category).joinedload(Category.parent),
        joinedload(LedgerTransaction.payment_method),
        joinedload(LedgerTransaction.account),
        joinedload(LedgerTransaction.to_account),
        joinedload(LedgerTransaction.card),
        joinedload(LedgerTransaction.tags),
    )


def _validate_card_payment_method(db: Session, payment_method_id: int | None, card_id: int | None) -> Card | None:
    if not card_id:
        return None
    card = validate_card_for_expense(db, card_id)
    if payment_method_id:
        method = db.get(PaymentMethod, payment_method_id)
        if method and method.name == "카드":
            return card
    return card


def _resolve_create_payload(db: Session, payload: LedgerTransactionCreate) -> dict:
    method = db.get(PaymentMethod, payload.payment_method_id) if payload.payment_method_id else None
    method_name = method.name if method else None
    card = _validate_card_payment_method(db, payload.payment_method_id, payload.card_id)

    if method and method.name == "카드" and not card:
        raise HTTPException(status_code=400, detail="카드 결제 시 카드를 선택해 주세요.")

    if payload.type == "income":
        if not payload.category_id:
            raise HTTPException(status_code=400, detail="카테고리를 선택해 주세요.")
        category = db.get(Category, payload.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
        if not payload.account_id:
            raise HTTPException(status_code=400, detail="입금 계좌를 선택해 주세요.")
        validate_account_for_transfer(db, payload.account_id)
        return {
            "type": "income",
            "category_id": category.id,
            "account_id": payload.account_id,
            "to_account_id": None,
            "card_id": None,
        }

    if payload.type == "reimbursement_out":
        if not payload.account_id:
            raise HTTPException(status_code=400, detail="출금 계좌를 선택해 주세요.")
        validate_account_for_transfer(db, payload.account_id)
        category = get_reimbursement_out_category(db)
        return {
            "type": "reimbursement_out",
            "category_id": category.id,
            "account_id": payload.account_id,
            "to_account_id": None,
            "card_id": None,
        }

    if payload.type == "reimbursement_in":
        if not payload.account_id:
            raise HTTPException(status_code=400, detail="입금 계좌를 선택해 주세요.")
        validate_account_for_transfer(db, payload.account_id)
        category = get_reimbursement_in_category(db)
        return {
            "type": "reimbursement_in",
            "category_id": category.id,
            "account_id": payload.account_id,
            "to_account_id": None,
            "card_id": None,
        }

    if is_bank_transfer_method(method_name):
        if not payload.account_id:
            raise HTTPException(status_code=400, detail="계좌이체 시 출금 계좌를 선택해 주세요.")
        if payload.to_account_id:
            if payload.type not in ("transfer", "expense"):
                raise HTTPException(status_code=400, detail="내부 이체는 transfer 유형으로 등록해야 합니다.")
            category = get_internal_transfer_category(db)
            return {
                "type": "transfer",
                "category_id": category.id,
                "account_id": payload.account_id,
                "to_account_id": payload.to_account_id,
                "card_id": None,
            }
        if payload.type != "expense":
            raise HTTPException(status_code=400, detail="외부 계좌이체는 지출로 등록해야 합니다.")
        if not payload.category_id:
            raise HTTPException(status_code=400, detail="카테고리를 선택해 주세요.")
        category = db.get(Category, payload.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
        return {
            "type": "expense",
            "category_id": category.id,
            "account_id": payload.account_id,
            "to_account_id": None,
            "card_id": None,
        }

    if not payload.category_id:
        raise HTTPException(status_code=400, detail="카테고리를 선택해 주세요.")
    category = db.get(Category, payload.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")

    account_id = payload.account_id or resolve_account_id_for_card(card)
    return {
        "type": payload.type,
        "category_id": category.id,
        "account_id": account_id,
        "to_account_id": None,
        "card_id": card.id if card else None,
    }


@router.get("", response_model=PaginatedResponse[LedgerTransactionResponse])
def list_ledger_transactions(
    type: str | None = None,
    category_id: int | None = None,
    include_subcategories: bool = True,
    payment_method_id: int | None = None,
    account_id: int | None = None,
    card_id: int | None = None,
    is_fixed: bool | None = None,
    tag: str | None = None,
    q: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    sort_order: str = "desc",
    db: Session = Depends(get_db),
):
    query = _ledger_tx_query(db)
    if type:
        query = query.filter(LedgerTransaction.type == type)
    if category_id:
        if include_subcategories:
            ids = get_category_descendant_ids(db, category_id)
            query = query.filter(LedgerTransaction.category_id.in_(ids))
        else:
            query = query.filter(LedgerTransaction.category_id == category_id)
    if payment_method_id:
        query = query.filter(LedgerTransaction.payment_method_id == payment_method_id)
    if account_id:
        query = query.filter(
            or_(
                LedgerTransaction.account_id == account_id,
                LedgerTransaction.to_account_id == account_id,
            )
        )
    if card_id:
        query = query.filter(LedgerTransaction.card_id == card_id)
    if is_fixed is not None:
        query = query.filter(LedgerTransaction.is_fixed == is_fixed)
    if tag:
        query = query.join(LedgerTransaction.tags).filter(Tag.name == tag)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(LedgerTransaction.memo.ilike(like), LedgerTransaction.merchant.ilike(like)))
    if from_date:
        query = query.filter(LedgerTransaction.transaction_date >= from_date)
    if to_date:
        query = query.filter(LedgerTransaction.transaction_date <= to_date)
    total = query.count()
    if sort_order == "asc":
        query = query.order_by(LedgerTransaction.transaction_date.asc(), LedgerTransaction.id.asc())
    else:
        query = query.order_by(LedgerTransaction.transaction_date.desc(), LedgerTransaction.id.desc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return PaginatedResponse(
        items=[_serialize_ledger_tx(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=LedgerTransactionResponse, status_code=201)
def create_ledger_transaction(payload: LedgerTransactionCreate, db: Session = Depends(get_db)):
    resolved = _resolve_create_payload(db, payload)

    tx = LedgerTransaction(
        transaction_date=payload.transaction_date,
        type=resolved["type"],
        amount=payload.amount,
        category_id=resolved["category_id"],
        payment_method_id=(
            None
            if resolved["type"] in ("income", "reimbursement_out", "reimbursement_in")
            else payload.payment_method_id
        ),
        account_id=resolved["account_id"],
        to_account_id=resolved["to_account_id"],
        card_id=resolved["card_id"],
        merchant=payload.merchant,
        memo=payload.memo,
        is_fixed=payload.is_fixed,
    )
    for tag_name in payload.tag_names:
        tx.tags.append(get_or_create_tag(db, tag_name))
    db.add(tx)
    db.flush()

    tx = _ledger_tx_query(db).filter(LedgerTransaction.id == tx.id).first()
    apply_ledger_balance_effects(db, tx)

    db.commit()
    tx = _ledger_tx_query(db).filter(LedgerTransaction.id == tx.id).first()
    return _serialize_ledger_tx(tx)


@router.patch("/{transaction_id}", response_model=LedgerTransactionResponse)
def update_ledger_transaction(
    transaction_id: int,
    payload: LedgerTransactionUpdate,
    db: Session = Depends(get_db),
):
    tx = _ledger_tx_query(db).filter(LedgerTransaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다.")

    reverse_ledger_balance_effects(db, tx)

    data = payload.model_dump(exclude_unset=True)
    tag_names = data.pop("tag_names", None)

    new_payment_method_id = data.get("payment_method_id", tx.payment_method_id)
    method = db.get(PaymentMethod, new_payment_method_id) if new_payment_method_id else None
    new_card_id = data.get("card_id", tx.card_id)
    card = (
        _validate_card_payment_method(db, new_payment_method_id, new_card_id)
        if method and method.name == "카드"
        else None
    )
    if method and method.name == "카드" and not card:
        raise HTTPException(status_code=400, detail="카드 결제 시 카드를 선택해 주세요.")

    for key, value in data.items():
        setattr(tx, key, value)

    if tag_names is not None:
        tx.tags = [get_or_create_tag(db, name) for name in tag_names]

    if method and method.name == "카드" and card:
        tx.card_id = card.id
        tx.account_id = data.get("account_id", tx.account_id) or resolve_account_id_for_card(card)
        tx.to_account_id = None
    elif method and method.name != "카드":
        if method and not is_bank_transfer_method(method.name):
            tx.card_id = None
        if method and is_bank_transfer_method(method.name) and not tx.to_account_id:
            tx.card_id = None

    if tx.type == "transfer":
        tx.category_id = get_internal_transfer_category(db).id
    elif tx.type == "income":
        tx.payment_method_id = None
        tx.card_id = None
        tx.to_account_id = None
        if not tx.account_id:
            raise HTTPException(status_code=400, detail="입금 계좌를 선택해 주세요.")
        validate_account_for_transfer(db, tx.account_id)
    elif tx.type == "reimbursement_out":
        tx.payment_method_id = None
        tx.card_id = None
        tx.to_account_id = None
        tx.category_id = get_reimbursement_out_category(db).id
        if not tx.account_id:
            raise HTTPException(status_code=400, detail="출금 계좌를 선택해 주세요.")
        validate_account_for_transfer(db, tx.account_id)
    elif tx.type == "reimbursement_in":
        tx.payment_method_id = None
        tx.card_id = None
        tx.to_account_id = None
        tx.category_id = get_reimbursement_in_category(db).id
        if not tx.account_id:
            raise HTTPException(status_code=400, detail="입금 계좌를 선택해 주세요.")
        validate_account_for_transfer(db, tx.account_id)

    db.flush()
    tx = _ledger_tx_query(db).filter(LedgerTransaction.id == tx.id).first()
    apply_ledger_balance_effects(db, tx)

    db.commit()
    tx = _ledger_tx_query(db).filter(LedgerTransaction.id == tx.id).first()
    return _serialize_ledger_tx(tx)


@router.delete("/{transaction_id}", status_code=204)
def delete_ledger_transaction(transaction_id: int, db: Session = Depends(get_db)):
    tx = (
        db.query(LedgerTransaction)
        .options(
            joinedload(LedgerTransaction.card),
            joinedload(LedgerTransaction.payment_method),
        )
        .filter(LedgerTransaction.id == transaction_id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다.")
    reverse_ledger_balance_effects(db, tx)
    db.delete(tx)
    db.commit()


@router.get("/summary", response_model=LedgerSummaryResponse)
def ledger_summary(
    year: int = Query(...),
    month: int = Query(...),
    group_by: str = Query(default="category"),
    db: Session = Depends(get_db),
):
    income_total = (
        db.query(func.coalesce(func.sum(LedgerTransaction.amount), 0))
        .filter(
            LedgerTransaction.type == "income",
            func.strftime("%Y", LedgerTransaction.transaction_date) == str(year),
            func.strftime("%m", LedgerTransaction.transaction_date) == f"{month:02d}",
        )
        .scalar()
    )
    expense_total = (
        db.query(func.coalesce(func.sum(LedgerTransaction.amount), 0))
        .filter(
            LedgerTransaction.type == "expense",
            func.strftime("%Y", LedgerTransaction.transaction_date) == str(year),
            func.strftime("%m", LedgerTransaction.transaction_date) == f"{month:02d}",
        )
        .scalar()
    )
    income_total = Decimal(str(income_total))
    expense_total = Decimal(str(expense_total))

    by_category: list[LedgerSummaryCategory] = []
    if group_by == "category":
        parents = (
            db.query(Category)
            .filter(Category.parent_id.is_(None), Category.type == "expense", Category.is_active.is_(True))
            .all()
        )
        for parent in parents:
            ids = get_category_descendant_ids(db, parent.id)
            amount = (
                db.query(func.coalesce(func.sum(LedgerTransaction.amount), 0))
                .filter(
                    LedgerTransaction.type == "expense",
                    LedgerTransaction.category_id.in_(ids),
                    func.strftime("%Y", LedgerTransaction.transaction_date) == str(year),
                    func.strftime("%m", LedgerTransaction.transaction_date) == f"{month:02d}",
                )
                .scalar()
            )
            amount = Decimal(str(amount))
            ratio = (amount / expense_total * 100) if expense_total > 0 else Decimal("0")
            budget = (
                db.query(Budget)
                .filter(Budget.category_id == parent.id, Budget.year == year, Budget.month == month)
                .first()
            )
            budget_amount = Decimal(str(budget.amount)) if budget else None
            over_budget = bool(budget_amount is not None and amount > budget_amount)
            by_category.append(
                LedgerSummaryCategory(
                    category_id=parent.id,
                    category_name=parent.name,
                    parent_name=None,
                    amount=amount,
                    ratio=ratio.quantize(Decimal("0.01")),
                    budget=budget_amount,
                    over_budget=over_budget,
                )
            )

    card_rows = (
        db.query(
            LedgerTransaction.card_id,
            func.coalesce(func.sum(LedgerTransaction.amount), 0).label("amount"),
        )
        .filter(
            LedgerTransaction.type == "expense",
            LedgerTransaction.card_id.isnot(None),
            func.strftime("%Y", LedgerTransaction.transaction_date) == str(year),
            func.strftime("%m", LedgerTransaction.transaction_date) == f"{month:02d}",
        )
        .group_by(LedgerTransaction.card_id)
        .all()
    )
    card_ids = [row.card_id for row in card_rows if row.card_id is not None]
    cards_by_id = {}
    if card_ids:
        cards = db.query(Card).filter(Card.id.in_(card_ids)).all()
        cards_by_id = {card.id: card for card in cards}
    by_card: list[LedgerSummaryCard] = []
    for row in card_rows:
        if row.card_id is None:
            continue
        card = cards_by_id.get(row.card_id)
        if not card:
            continue
        amount = Decimal(str(row.amount))
        ratio = (amount / expense_total * 100) if expense_total > 0 else Decimal("0")
        by_card.append(
            LedgerSummaryCard(
                card_id=card.id,
                card_name=card.name,
                card_type=card.card_type,
                institution=card.institution,
                last_four=card.last_four,
                amount=amount,
                ratio=ratio.quantize(Decimal("0.01")),
            )
        )
    by_card.sort(key=lambda item: item.amount, reverse=True)

    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_expense = (
        db.query(func.coalesce(func.sum(LedgerTransaction.amount), 0))
        .filter(
            LedgerTransaction.type == "expense",
            func.strftime("%Y", LedgerTransaction.transaction_date) == str(prev_year),
            func.strftime("%m", LedgerTransaction.transaction_date) == f"{prev_month:02d}",
        )
        .scalar()
    )
    prev_expense = Decimal(str(prev_expense))
    change_rate = (
        ((expense_total - prev_expense) / prev_expense * 100) if prev_expense > 0 else Decimal("0")
    )

    return LedgerSummaryResponse(
        period={"year": year, "month": month},
        total_income=income_total,
        total_expense=expense_total,
        net_cashflow=income_total - expense_total,
        by_category=by_category,
        by_card=by_card,
        comparison=LedgerSummaryComparison(
            prev_month_expense=prev_expense,
            expense_change_rate=change_rate.quantize(Decimal("0.01")),
        ),
    )
