from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Account,
    AccountType,
    Card,
    CardSettlement,
    Category,
    LedgerTransaction,
    Liability,
    LiabilityTransaction,
    PaymentMethod,
)
from app.utils import to_decimal


def get_card_payment_category(db: Session) -> Category:
    category = (
        db.query(Category)
        .filter(Category.name == "카드대금", Category.type == "expense", Category.is_active.is_(True))
        .first()
    )
    if not category:
        raise HTTPException(status_code=500, detail="카드대금 카테고리가 없습니다. 초기 설정을 실행해 주세요.")
    return category


def get_card_payment_method(db: Session) -> PaymentMethod:
    method = db.query(PaymentMethod).filter(PaymentMethod.name == "카드").first()
    if not method:
        raise HTTPException(status_code=500, detail="카드 결제수단이 없습니다. 초기 설정을 실행해 주세요.")
    return method


def validate_card_for_expense(db: Session, card_id: int) -> Card:
    card = db.get(Card, card_id)
    if not card or not card.is_active:
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없습니다.")
    if card.card_type == "debit":
        if not card.linked_account_id:
            raise HTTPException(status_code=400, detail="체크카드에 연결된 계좌가 없습니다.")
        account = db.get(Account, card.linked_account_id)
        if not account or not account.is_active:
            raise HTTPException(status_code=400, detail="체크카드에 연결된 계좌를 찾을 수 없습니다.")
    elif card.card_type == "credit":
        if not card.linked_liability_id:
            raise HTTPException(status_code=400, detail="신용카드에 연결된 부채가 없습니다.")
        liability = db.get(Liability, card.linked_liability_id)
        if not liability or not liability.is_active:
            raise HTTPException(status_code=400, detail="신용카드에 연결된 부채를 찾을 수 없습니다.")
    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 카드 유형입니다.")
    return card


def apply_card_expense(db: Session, card: Card, amount: Decimal) -> int | None:
    amount = to_decimal(amount)
    if card.card_type == "debit":
        account = db.get(Account, card.linked_account_id)
        account.cash_balance = to_decimal(account.cash_balance) - amount
        return card.linked_account_id
    liability = db.get(Liability, card.linked_liability_id)
    liability.current_balance = to_decimal(liability.current_balance) + amount
    tx = LiabilityTransaction(
        liability_id=liability.id,
        transaction_date=date.today(),
        type="charge",
        amount=amount,
        memo="카드 지출",
    )
    db.add(tx)
    return None


def reverse_card_expense(db: Session, card: Card, amount: Decimal) -> None:
    amount = to_decimal(amount)
    if card.card_type == "debit":
        account = db.get(Account, card.linked_account_id)
        account.cash_balance = to_decimal(account.cash_balance) + amount
        return
    liability = db.get(Liability, card.linked_liability_id)
    liability.current_balance = to_decimal(liability.current_balance) - amount
    tx = LiabilityTransaction(
        liability_id=liability.id,
        transaction_date=date.today(),
        type="payment",
        amount=amount,
        memo="카드 지출 취소",
    )
    db.add(tx)


def resolve_account_id_for_card(card: Card | None) -> int | None:
    if not card:
        return None
    if card.card_type == "debit":
        return card.linked_account_id
    return None


def process_due_card_payments(db: Session, as_of: date | None = None) -> list[CardSettlement]:
    today = as_of or date.today()
    processed: list[CardSettlement] = []

    cards = (
        db.query(Card)
        .filter(
            Card.card_type == "credit",
            Card.is_active.is_(True),
            Card.due_day.isnot(None),
            Card.settlement_account_id.isnot(None),
            Card.linked_liability_id.isnot(None),
        )
        .all()
    )

    for card in cards:
        if today.day < card.due_day:
            continue

        existing = (
            db.query(CardSettlement)
            .filter(
                CardSettlement.card_id == card.id,
                CardSettlement.year == today.year,
                CardSettlement.month == today.month,
            )
            .first()
        )
        if existing:
            continue

        liability = db.get(Liability, card.linked_liability_id)
        account = db.get(Account, card.settlement_account_id)
        if not liability or not account:
            continue

        amount = to_decimal(liability.current_balance)
        if amount <= 0:
            continue
        if to_decimal(account.cash_balance) < amount:
            continue

        account.cash_balance = to_decimal(account.cash_balance) - amount
        liability.current_balance = to_decimal(liability.current_balance) - amount

        liability_tx = LiabilityTransaction(
            liability_id=liability.id,
            transaction_date=today,
            type="payment",
            amount=amount,
            memo=f"{card.name} 자동 결제",
        )
        db.add(liability_tx)

        category = get_card_payment_category(db)
        payment_method = get_card_payment_method(db)
        ledger_tx = LedgerTransaction(
            transaction_date=today,
            type="expense",
            amount=amount,
            category_id=category.id,
            payment_method_id=payment_method.id,
            account_id=card.settlement_account_id,
            card_id=card.id,
            merchant=card.name,
            memo=f"{card.name} 카드대금 자동 결제",
            is_fixed=True,
        )
        db.add(ledger_tx)

        settlement = CardSettlement(
            card_id=card.id,
            year=today.year,
            month=today.month,
            amount=amount,
            settlement_date=today,
        )
        db.add(settlement)
        processed.append(settlement)

    if processed:
        db.commit()
        for item in processed:
            db.refresh(item)
    return processed


def validate_checking_account(db: Session, account_id: int) -> Account:
    account = (
        db.query(Account)
        .join(AccountType)
        .filter(Account.id == account_id, AccountType.code == "CHECKING", Account.is_active.is_(True))
        .first()
    )
    if not account:
        raise HTTPException(status_code=400, detail="입출금 계좌만 연결할 수 있습니다.")
    return account
