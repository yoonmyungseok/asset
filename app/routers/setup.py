from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.system import HealthResponse, InitializeResponse
from app.services.core import initialize_all

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return HealthResponse(status="ok", db="connected", version="0.1.0")


@router.post("/setup/initialize", response_model=InitializeResponse, status_code=201)
def setup_initialize(db: Session = Depends(get_db)):
    counts = initialize_all(db)
    return InitializeResponse(
        account_types=counts["account_types"],
        payment_methods=counts["payment_methods"],
        categories=counts["categories"],
        message="초기 설정 완료",
    )
