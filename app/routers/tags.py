from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import LedgerTransactionTag, Tag
from app.schemas.ledger import TagCreate, TagResponse

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
def list_tags(db: Session = Depends(get_db)):
    tags = db.query(Tag).order_by(Tag.name).all()
    results = []
    for tag in tags:
        usage_count = (
            db.query(func.count(LedgerTransactionTag.tag_id))
            .filter(LedgerTransactionTag.tag_id == tag.id)
            .scalar()
        )
        results.append(TagResponse(id=tag.id, name=tag.name, usage_count=usage_count or 0))
    return results


@router.post("", response_model=TagResponse, status_code=201)
def create_tag(payload: TagCreate, db: Session = Depends(get_db)):
    exists = db.query(Tag).filter(Tag.name == payload.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="이미 존재하는 태그입니다.")
    tag = Tag(name=payload.name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return TagResponse(id=tag.id, name=tag.name, usage_count=0)


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="태그를 찾을 수 없습니다.")
    db.query(LedgerTransactionTag).filter(LedgerTransactionTag.tag_id == tag_id).delete()
    db.delete(tag)
    db.commit()
