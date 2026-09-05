from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import SessionLocal
from app.migrations import run_migrations
from app.services.card_payments import process_due_card_payments
from app.services.core import seed_account_types, seed_categories
from app.routers import (
    account_limits,
    account_types,
    accounts,
    backup,
    budgets,
    cards,
    categories,
    dashboard,
    holdings,
    institutions,
    investment_transactions,
    ledger_transactions,
    liabilities,
    market,
    payment_methods,
    recurring_items,
    setup,
    snapshots,
    tags,
)

run_migrations()
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

app = FastAPI(
    title="Asset Manager API",
    description="개인 자산관리 + 가계부 통합 API",
    version="0.1.0",
)


@app.on_event("startup")
def on_startup() -> None:
    db = SessionLocal()
    try:
        seed_account_types(db)
        seed_categories(db)
        process_due_card_payments(db)
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(setup.router, prefix=API_PREFIX)
app.include_router(account_types.router, prefix=API_PREFIX)
app.include_router(accounts.router, prefix=API_PREFIX)
app.include_router(holdings.router, prefix=API_PREFIX)
app.include_router(institutions.router, prefix=API_PREFIX)
app.include_router(investment_transactions.router, prefix=API_PREFIX)
app.include_router(account_limits.router, prefix=API_PREFIX)
app.include_router(categories.router, prefix=API_PREFIX)
app.include_router(payment_methods.router, prefix=API_PREFIX)
app.include_router(cards.router, prefix=API_PREFIX)
app.include_router(ledger_transactions.router, prefix=API_PREFIX)
app.include_router(tags.router, prefix=API_PREFIX)
app.include_router(recurring_items.router, prefix=API_PREFIX)
app.include_router(budgets.router, prefix=API_PREFIX)
app.include_router(liabilities.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(snapshots.router, prefix=API_PREFIX)
app.include_router(market.router, prefix=API_PREFIX)
app.include_router(backup.router, prefix=API_PREFIX)


def _mount_frontend() -> None:
    if not FRONTEND_DIST.is_dir():
        return

    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    index_file = FRONTEND_DIST / "index.html"

    @app.get("/", include_in_schema=False)
    def serve_root():
        return FileResponse(index_file)

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(index_file)


if FRONTEND_DIST.is_dir():
    _mount_frontend()
else:

    @app.get("/")
    def root():
        return {"message": "Asset Manager API", "docs": "/docs", "frontend": "frontend/dist 빌드 필요"}

