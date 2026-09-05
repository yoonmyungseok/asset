from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, LedgerTransaction
from app.schemas.ledger import CategoryCreate, CategoryResponse, CategoryTree, CategoryUpdate
from app.services.core import seed_categories

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryTree] | list[CategoryResponse])
def list_categories(
    type: str | None = None,
    parent_id: int | None = None,
    include_children: bool = False,
    is_active: bool = True,
    db: Session = Depends(get_db),
):
    if include_children:
        parents = db.query(Category).filter(Category.parent_id.is_(None))
        if type:
            parents = parents.filter(Category.type == type)
        if is_active is not None:
            parents = parents.filter(Category.is_active == is_active)
        parents = parents.order_by(Category.sort_order, Category.id).all()
        result = []
        for parent in parents:
            children = (
                db.query(Category)
                .filter(Category.parent_id == parent.id)
                .order_by(Category.sort_order, Category.id)
                .all()
            )
            result.append(
                CategoryTree(
                    id=parent.id,
                    name=parent.name,
                    type=parent.type,
                    parent_id=parent.parent_id,
                    sort_order=parent.sort_order,
                    is_system=parent.is_system,
                    is_active=parent.is_active,
                    children=children,
                )
            )
        return result

    query = db.query(Category)
    if type:
        query = query.filter(Category.type == type)
    if parent_id is not None:
        query = query.filter(Category.parent_id == parent_id)
    if is_active is not None:
        query = query.filter(Category.is_active == is_active)
    return query.order_by(Category.sort_order, Category.id).all()


@router.post("", response_model=CategoryResponse, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    if payload.parent_id:
        parent = db.get(Category, payload.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="상위 카테고리를 찾을 수 없습니다.")
        if parent.parent_id is not None:
            raise HTTPException(status_code=400, detail="2단계 카테고리만 지원합니다.")
    category = Category(
        name=payload.name,
        type=payload.type,
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
        is_system=False,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    has_tx = db.query(LedgerTransaction).filter(LedgerTransaction.category_id == category_id).first()
    if has_tx:
        raise HTTPException(status_code=400, detail="연결된 거래가 있어 삭제할 수 없습니다. 비활성화를 사용하세요.")
    db.delete(category)
    db.commit()


@router.post("/seed")
def seed_default_categories(db: Session = Depends(get_db)):
    count = seed_categories(db)
    return {"created": count, "message": "기본 카테고리 생성 완료"}
