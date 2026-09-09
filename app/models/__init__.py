from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AccountType(Base):
    __tablename__ = "account_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    supports_holdings: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_contribution_limit: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True)

    accounts: Mapped[list["Account"]] = relationship(back_populates="account_type")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_type_id: Mapped[int] = mapped_column(ForeignKey("account_types.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(200))
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    metadata_json: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    account_type: Mapped["AccountType"] = relationship(back_populates="accounts")
    holdings: Mapped[list["Holding"]] = relationship(back_populates="account")
    investment_transactions: Mapped[list["InvestmentTransaction"]] = relationship(
        back_populates="account"
    )
    yearly_limits: Mapped[list["AccountYearlyLimit"]] = relationship(back_populates="account")
    ledger_transactions: Mapped[list["LedgerTransaction"]] = relationship(
        back_populates="account", foreign_keys="LedgerTransaction.account_id"
    )


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    asset_class: Mapped[str] = mapped_column(String(20), default="stock", nullable=False)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=0)
    avg_cost_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    manual_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    start_date: Mapped[date | None] = mapped_column(Date)
    maturity_date: Mapped[date | None] = mapped_column(Date)
    last_market_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    last_price_updated_at: Mapped[datetime | None] = mapped_column(DateTime)

    account: Mapped["Account"] = relationship(back_populates="holdings")
    investment_transactions: Mapped[list["InvestmentTransaction"]] = relationship(
        back_populates="holding"
    )


class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    holding_id: Mapped[int | None] = mapped_column(ForeignKey("holdings.id"))
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    fee: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    memo: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    account: Mapped["Account"] = relationship(back_populates="investment_transactions")
    holding: Mapped["Holding | None"] = relationship(back_populates="investment_transactions")


class AccountYearlyLimit(Base):
    __tablename__ = "account_yearly_limits"
    __table_args__ = (UniqueConstraint("account_id", "year", name="uq_account_year"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    contribution_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    contributed_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)

    account: Mapped["Account"] = relationship(back_populates="yearly_limits")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parent: Mapped["Category | None"] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[list["Category"]] = relationship(back_populates="parent")
    ledger_transactions: Mapped[list["LedgerTransaction"]] = relationship(back_populates="category")
    budgets: Mapped[list["Budget"]] = relationship(back_populates="category")
    recurring_items: Mapped[list["RecurringItem"]] = relationship(back_populates="category")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    ledger_transactions: Mapped[list["LedgerTransaction"]] = relationship(
        back_populates="payment_method"
    )
    recurring_items: Mapped[list["RecurringItem"]] = relationship(back_populates="payment_method")


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    card_type: Mapped[str] = mapped_column(String(20), nullable=False)  # debit | credit
    institution: Mapped[str | None] = mapped_column(String(200))
    last_four: Mapped[str | None] = mapped_column(String(4))
    linked_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    linked_liability_id: Mapped[int | None] = mapped_column(ForeignKey("liabilities.id"))
    settlement_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    due_day: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    linked_account: Mapped["Account | None"] = relationship(foreign_keys=[linked_account_id])
    settlement_account: Mapped["Account | None"] = relationship(foreign_keys=[settlement_account_id])
    linked_liability: Mapped["Liability | None"] = relationship(foreign_keys=[linked_liability_id])
    ledger_transactions: Mapped[list["LedgerTransaction"]] = relationship(back_populates="card")
    recurring_items: Mapped[list["RecurringItem"]] = relationship(back_populates="card")
    settlements: Mapped[list["CardSettlement"]] = relationship(back_populates="card")


class CardSettlement(Base):
    __tablename__ = "card_settlements"
    __table_args__ = (UniqueConstraint("card_id", "year", "month", name="uq_card_settlement_period"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    settlement_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    card: Mapped["Card"] = relationship(back_populates="settlements")


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    payment_method_id: Mapped[int | None] = mapped_column(ForeignKey("payment_methods.id"))
    account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    to_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    card_id: Mapped[int | None] = mapped_column(ForeignKey("cards.id"))
    merchant: Mapped[str | None] = mapped_column(String(200))
    memo: Mapped[str | None] = mapped_column(Text)
    is_fixed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    category: Mapped["Category"] = relationship(back_populates="ledger_transactions")
    payment_method: Mapped["PaymentMethod | None"] = relationship(
        back_populates="ledger_transactions"
    )
    account: Mapped["Account | None"] = relationship(
        back_populates="ledger_transactions", foreign_keys=[account_id]
    )
    to_account: Mapped["Account | None"] = relationship(foreign_keys=[to_account_id])
    card: Mapped["Card | None"] = relationship(back_populates="ledger_transactions")
    tags: Mapped[list["Tag"]] = relationship(
        secondary="ledger_transaction_tags", back_populates="ledger_transactions"
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    ledger_transactions: Mapped[list["LedgerTransaction"]] = relationship(
        secondary="ledger_transaction_tags", back_populates="tags"
    )


class LedgerTransactionTag(Base):
    __tablename__ = "ledger_transaction_tags"

    ledger_transaction_id: Mapped[int] = mapped_column(
        ForeignKey("ledger_transactions.id"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)


class RecurringItem(Base):
    __tablename__ = "recurring_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    payment_method_id: Mapped[int | None] = mapped_column(ForeignKey("payment_methods.id"))
    account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    to_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    card_id: Mapped[int | None] = mapped_column(ForeignKey("cards.id"))
    merchant: Mapped[str | None] = mapped_column(String(200))
    memo: Mapped[str | None] = mapped_column(Text)
    frequency: Mapped[str] = mapped_column(String(20), default="monthly")
    day_of_month: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped["Category"] = relationship(back_populates="recurring_items")
    payment_method: Mapped["PaymentMethod | None"] = relationship(back_populates="recurring_items")
    account: Mapped["Account | None"] = relationship(foreign_keys=[account_id])
    to_account: Mapped["Account | None"] = relationship(foreign_keys=[to_account_id])
    card: Mapped["Card | None"] = relationship(back_populates="recurring_items")


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("category_id", "year", "month", name="uq_budget_period"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)

    category: Mapped["Category"] = relationship(back_populates="budgets")


class Liability(Base):
    __tablename__ = "liabilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(200))
    original_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    current_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    due_day: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    transactions: Mapped[list["LiabilityTransaction"]] = relationship(back_populates="liability")


class LiabilityTransaction(Base):
    __tablename__ = "liability_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    liability_id: Mapped[int] = mapped_column(ForeignKey("liabilities.id"), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    memo: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    liability: Mapped["Liability"] = relationship(back_populates="transactions")


class DailySnapshot(Base):
    __tablename__ = "daily_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    total_assets: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total_liabilities: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    net_worth: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    investment_total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    cash_total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)


class AccountSnapshot(Base):
    __tablename__ = "account_snapshots"
    __table_args__ = (UniqueConstraint("snapshot_date", "account_id", name="uq_account_snapshot"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    balance_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)


class LiabilitySnapshot(Base):
    __tablename__ = "liability_snapshots"
    __table_args__ = (
        UniqueConstraint("snapshot_date", "liability_id", name="uq_liability_snapshot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    liability_id: Mapped[int] = mapped_column(ForeignKey("liabilities.id"), nullable=False)
    balance_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
