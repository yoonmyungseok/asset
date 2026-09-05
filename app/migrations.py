from sqlalchemy import inspect, text

from app.database import Base, engine
import app.models  # noqa: F401


def run_migrations() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    with engine.begin() as conn:
        if "ledger_transactions" in table_names:
            columns = {col["name"] for col in inspector.get_columns("ledger_transactions")}
            if "card_id" not in columns:
                conn.execute(text("ALTER TABLE ledger_transactions ADD COLUMN card_id INTEGER"))
            if "to_account_id" not in columns:
                conn.execute(text("ALTER TABLE ledger_transactions ADD COLUMN to_account_id INTEGER"))

        if "holdings" in table_names:
            columns = {col["name"] for col in inspector.get_columns("holdings")}
            if "asset_class" not in columns:
                conn.execute(text("ALTER TABLE holdings ADD COLUMN asset_class VARCHAR(20) DEFAULT 'stock' NOT NULL"))
            if "interest_rate" not in columns:
                conn.execute(text("ALTER TABLE holdings ADD COLUMN interest_rate NUMERIC(8, 4)"))
            if "maturity_date" not in columns:
                conn.execute(text("ALTER TABLE holdings ADD COLUMN maturity_date DATE"))
            if "start_date" not in columns:
                conn.execute(text("ALTER TABLE holdings ADD COLUMN start_date DATE"))

    Base.metadata.create_all(bind=engine)
