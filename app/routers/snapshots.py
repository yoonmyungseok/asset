from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AccountSnapshot, DailySnapshot
from app.schemas.system import AccountSnapshotPoint, DailySnapshotResponse
from app.services.core import save_daily_snapshot

router = APIRouter(prefix="/snapshots", tags=["snapshots"])


@router.post("/daily", response_model=DailySnapshotResponse, status_code=201)
def create_daily_snapshot(db: Session = Depends(get_db)):
    snapshot = save_daily_snapshot(db)
    return snapshot


@router.get("/daily", response_model=list[DailySnapshotResponse])
def list_daily_snapshots(
    from_date: date | None = None,
    to_date: date | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(DailySnapshot)
    if from_date:
        query = query.filter(DailySnapshot.snapshot_date >= from_date)
    if to_date:
        query = query.filter(DailySnapshot.snapshot_date <= to_date)
    return query.order_by(DailySnapshot.snapshot_date.asc()).all()


@router.get("/accounts/{account_id}", response_model=list[AccountSnapshotPoint])
def account_snapshots(
    account_id: int,
    from_date: date | None = None,
    to_date: date | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(AccountSnapshot).filter(AccountSnapshot.account_id == account_id)
    if from_date:
        query = query.filter(AccountSnapshot.snapshot_date >= from_date)
    if to_date:
        query = query.filter(AccountSnapshot.snapshot_date <= to_date)
    rows = query.order_by(AccountSnapshot.snapshot_date.asc()).all()
    return [
        AccountSnapshotPoint(snapshot_date=row.snapshot_date, balance_value=row.balance_value)
        for row in rows
    ]
