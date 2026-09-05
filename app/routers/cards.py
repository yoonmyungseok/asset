from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Account, Card, CardSettlement, Liability
from app.schemas.card import CardCreate, CardResponse, CardSettlementResponse, CardUpdate
from app.services.card_payments import process_due_card_payments, validate_checking_account

router = APIRouter(prefix="/cards", tags=["cards"])


def _serialize_card(card: Card) -> CardResponse:
    return CardResponse(
        id=card.id,
        name=card.name,
        card_type=card.card_type,
        institution=card.institution,
        last_four=card.last_four,
        linked_account_id=card.linked_account_id,
        linked_account_name=card.linked_account.name if card.linked_account else None,
        linked_liability_id=card.linked_liability_id,
        linked_liability_name=card.linked_liability.name if card.linked_liability else None,
        settlement_account_id=card.settlement_account_id,
        settlement_account_name=card.settlement_account.name if card.settlement_account else None,
        due_day=card.due_day,
        is_active=card.is_active,
    )


@router.get("", response_model=list[CardResponse])
def list_cards(is_active: bool | None = True, db: Session = Depends(get_db)):
    query = db.query(Card).options(
        joinedload(Card.linked_account),
        joinedload(Card.settlement_account),
        joinedload(Card.linked_liability),
    )
    if is_active is not None:
        query = query.filter(Card.is_active == is_active)
    cards = query.order_by(Card.id).all()
    return [_serialize_card(card) for card in cards]


@router.post("", response_model=CardResponse, status_code=201)
def create_card(payload: CardCreate, db: Session = Depends(get_db)):
    if payload.card_type == "debit":
        if not payload.linked_account_id:
            raise HTTPException(status_code=400, detail="체크카드는 연결 계좌가 필요합니다.")
        validate_checking_account(db, payload.linked_account_id)
        card = Card(
            name=payload.name,
            card_type="debit",
            institution=payload.institution,
            last_four=payload.last_four,
            linked_account_id=payload.linked_account_id,
        )
    else:
        if not payload.settlement_account_id or not payload.due_day:
            raise HTTPException(status_code=400, detail="신용카드는 결제 계좌와 결제일이 필요합니다.")
        validate_checking_account(db, payload.settlement_account_id)
        liability = Liability(
            type="credit_card",
            name=payload.name,
            institution=payload.institution,
            current_balance=0,
            due_day=payload.due_day,
        )
        db.add(liability)
        db.flush()
        card = Card(
            name=payload.name,
            card_type="credit",
            institution=payload.institution,
            last_four=payload.last_four,
            linked_liability_id=liability.id,
            settlement_account_id=payload.settlement_account_id,
            due_day=payload.due_day,
        )
    db.add(card)
    db.commit()
    card = (
        db.query(Card)
        .options(
            joinedload(Card.linked_account),
            joinedload(Card.settlement_account),
            joinedload(Card.linked_liability),
        )
        .filter(Card.id == card.id)
        .first()
    )
    return _serialize_card(card)


@router.patch("/{card_id}", response_model=CardResponse)
def update_card(card_id: int, payload: CardUpdate, db: Session = Depends(get_db)):
    card = (
        db.query(Card)
        .options(
            joinedload(Card.linked_account),
            joinedload(Card.settlement_account),
            joinedload(Card.linked_liability),
        )
        .filter(Card.id == card_id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없습니다.")

    data = payload.model_dump(exclude_unset=True)
    if "linked_account_id" in data and data["linked_account_id"] is not None:
        validate_checking_account(db, data["linked_account_id"])
    if "settlement_account_id" in data and data["settlement_account_id"] is not None:
        validate_checking_account(db, data["settlement_account_id"])

    for key, value in data.items():
        setattr(card, key, value)

    if card.card_type == "credit" and card.linked_liability:
        if "name" in data:
            card.linked_liability.name = data["name"]
        if "institution" in data:
            card.linked_liability.institution = data["institution"]
        if "due_day" in data:
            card.linked_liability.due_day = data["due_day"]

    db.commit()
    db.refresh(card)
    return _serialize_card(card)


@router.delete("/{card_id}", status_code=204)
def delete_card(card_id: int, db: Session = Depends(get_db)):
    card = db.get(Card, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없습니다.")
    card.is_active = False
    if card.linked_liability:
        card.linked_liability.is_active = False
    db.commit()


@router.post("/process-settlements", response_model=list[CardSettlementResponse])
def run_card_settlements(as_of: date | None = None, db: Session = Depends(get_db)):
    settlements = process_due_card_payments(db, as_of)
    if not settlements:
        return []
    ids = [item.id for item in settlements]
    rows = (
        db.query(CardSettlement)
        .options(joinedload(CardSettlement.card))
        .filter(CardSettlement.id.in_(ids))
        .all()
    )
    return [
        CardSettlementResponse(
            id=item.id,
            card_id=item.card_id,
            card_name=item.card.name,
            year=item.year,
            month=item.month,
            amount=item.amount,
            settlement_date=item.settlement_date,
        )
        for item in rows
    ]
