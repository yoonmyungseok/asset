from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Account, Category
from app.utils import to_decimal

INTERNAL_TRANSFER_CATEGORY_NAME = "내부이체"


def get_internal_transfer_category(db: Session) -> Category:
    category = (
        db.query(Category)
        .filter(
            Category.name == INTERNAL_TRANSFER_CATEGORY_NAME,
            Category.parent_id.is_(None),
            Category.is_active.is_(True),
        )
        .first()
    )
    if not category:
        category = Category(
            name=INTERNAL_TRANSFER_CATEGORY_NAME,
            type="expense",
            parent_id=None,
            is_system=True,
            sort_order=999,
        )
        db.add(category)
        db.flush()
    return category


def validate_account_for_transfer(db: Session, account_id: int) -> Account:
    account = db.get(Account, account_id)
    if not account or not account.is_active:
        raise HTTPException(status_code=400, detail="유효하지 않은 계좌입니다.")
    return account


def apply_internal_transfer(db: Session, from_account_id: int, to_account_id: int, amount: Decimal) -> None:
    if from_account_id == to_account_id:
        raise HTTPException(status_code=400, detail="출금·입금 계좌가 같을 수 없습니다.")
    amount = to_decimal(amount)
    from_account = validate_account_for_transfer(db, from_account_id)
    to_account = validate_account_for_transfer(db, to_account_id)
    from_account.cash_balance = to_decimal(from_account.cash_balance) - amount
    to_account.cash_balance = to_decimal(to_account.cash_balance) + amount


def reverse_internal_transfer(db: Session, from_account_id: int, to_account_id: int, amount: Decimal) -> None:
    amount = to_decimal(amount)
    from_account = db.get(Account, from_account_id)
    to_account = db.get(Account, to_account_id)
    if from_account:
        from_account.cash_balance = to_decimal(from_account.cash_balance) + amount
    if to_account:
        to_account.cash_balance = to_decimal(to_account.cash_balance) - amount


def apply_external_transfer(db: Session, from_account_id: int, amount: Decimal) -> None:
    amount = to_decimal(amount)
    account = validate_account_for_transfer(db, from_account_id)
    account.cash_balance = to_decimal(account.cash_balance) - amount


def reverse_external_transfer(db: Session, from_account_id: int, amount: Decimal) -> None:
    amount = to_decimal(amount)
    account = db.get(Account, from_account_id)
    if account:
        account.cash_balance = to_decimal(account.cash_balance) + amount


def is_bank_transfer_method(method_name: str | None) -> bool:
    return method_name == "계좌이체"


def reverse_ledger_balance_effects(db: Session, tx) -> None:
    from app.services.card_payments import reverse_card_expense

    method_name = tx.payment_method.name if tx.payment_method else None
    if tx.type == "transfer" and tx.account_id and tx.to_account_id:
        reverse_internal_transfer(db, tx.account_id, tx.to_account_id, tx.amount)
    elif (
        tx.type == "expense"
        and is_bank_transfer_method(method_name)
        and tx.account_id
        and not tx.to_account_id
    ):
        reverse_external_transfer(db, tx.account_id, tx.amount)
    elif tx.type == "expense" and tx.card:
        reverse_card_expense(db, tx.card, tx.amount)


def apply_ledger_balance_effects(db: Session, tx) -> None:
    from app.services.card_payments import apply_card_expense

    method_name = tx.payment_method.name if tx.payment_method else None
    if tx.type == "transfer" and tx.account_id and tx.to_account_id:
        apply_internal_transfer(db, tx.account_id, tx.to_account_id, tx.amount)
    elif (
        tx.type == "expense"
        and is_bank_transfer_method(method_name)
        and tx.account_id
        and not tx.to_account_id
    ):
        apply_external_transfer(db, tx.account_id, tx.amount)
    elif tx.type == "expense" and tx.card:
        apply_card_expense(db, tx.card, tx.amount)
