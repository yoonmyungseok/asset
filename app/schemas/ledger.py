from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.card import CardBrief

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CategoryChild(ORMModel):
    id: int
    name: str
    parent_id: int | None
    type: str
    sort_order: int
    is_system: bool
    is_active: bool


class CategoryTree(ORMModel):
    id: int
    name: str
    type: str
    parent_id: int | None
    sort_order: int
    is_system: bool
    is_active: bool
    children: list[CategoryChild] = Field(default_factory=list)


class CategoryResponse(ORMModel):
    id: int
    name: str
    type: str
    parent_id: int | None
    sort_order: int
    is_system: bool
    is_active: bool


class CategoryCreate(BaseModel):
    name: str
    type: str
    parent_id: int | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class PaymentMethodResponse(ORMModel):
    id: int
    name: str
    is_system: bool


class PaymentMethodCreate(BaseModel):
    name: str


class CategoryBrief(BaseModel):
    id: int
    name: str
    parent_name: str | None = None


class PaymentMethodBrief(BaseModel):
    id: int
    name: str


class LedgerTransactionResponse(ORMModel):
    id: int
    transaction_date: date
    type: str
    amount: Decimal
    category: CategoryBrief
    payment_method: PaymentMethodBrief | None = None
    account_id: int | None
    to_account_id: int | None = None
    account_name: str | None = None
    to_account_name: str | None = None
    card: CardBrief | None = None
    merchant: str | None
    memo: str | None
    is_fixed: bool
    tags: list[str] = Field(default_factory=list)


class LedgerTransactionCreate(BaseModel):
    transaction_date: date
    type: str
    amount: Decimal
    category_id: int | None = None
    payment_method_id: int | None = None
    account_id: int | None = None
    to_account_id: int | None = None
    card_id: int | None = None
    merchant: str | None = None
    memo: str | None = None
    is_fixed: bool = False
    tag_names: list[str] = Field(default_factory=list)


class LedgerTransactionUpdate(BaseModel):
    transaction_date: date | None = None
    type: str | None = None
    amount: Decimal | None = None
    category_id: int | None = None
    payment_method_id: int | None = None
    account_id: int | None = None
    to_account_id: int | None = None
    card_id: int | None = None
    merchant: str | None = None
    memo: str | None = None
    is_fixed: bool | None = None
    tag_names: list[str] | None = None

class LedgerSummaryCategory(BaseModel):
    category_id: int
    category_name: str
    parent_name: str | None
    amount: Decimal
    ratio: Decimal
    budget: Decimal | None = None
    over_budget: bool = False


class LedgerSummaryComparison(BaseModel):
    prev_month_expense: Decimal
    expense_change_rate: Decimal


class LedgerSummaryCard(BaseModel):
    card_id: int
    card_name: str
    card_type: str
    institution: str | None = None
    last_four: str | None = None
    amount: Decimal
    ratio: Decimal


class LedgerSummaryResponse(BaseModel):
    period: dict[str, int]
    total_income: Decimal
    total_expense: Decimal
    net_cashflow: Decimal
    by_category: list[LedgerSummaryCategory]
    by_card: list[LedgerSummaryCard] = Field(default_factory=list)
    comparison: LedgerSummaryComparison | None = None


class TagResponse(BaseModel):
    id: int
    name: str
    usage_count: int


class TagCreate(BaseModel):
    name: str


class RecurringItemResponse(BaseModel):
    id: int
    type: str
    amount: Decimal
    category: CategoryBrief
    payment_method: PaymentMethodBrief | None = None
    account_id: int | None = None
    to_account_id: int | None = None
    account_name: str | None = None
    to_account_name: str | None = None
    card: CardBrief | None = None
    merchant: str | None
    memo: str | None
    frequency: str
    day_of_month: int
    is_active: bool


class RecurringItemCreate(BaseModel):
    type: str
    amount: Decimal
    category_id: int
    payment_method_id: int | None = None
    account_id: int | None = None
    to_account_id: int | None = None
    card_id: int | None = None
    merchant: str | None = None
    memo: str | None = None
    frequency: str = "monthly"
    day_of_month: int = 1


class RecurringItemUpdate(BaseModel):
    type: str | None = None
    amount: Decimal | None = None
    category_id: int | None = None
    payment_method_id: int | None = None
    account_id: int | None = None
    to_account_id: int | None = None
    card_id: int | None = None
    merchant: str | None = None
    memo: str | None = None
    frequency: str | None = None
    day_of_month: int | None = None
    is_active: bool | None = None


class RecurringGenerateRequest(BaseModel):
    year: int
    month: int


class RecurringGenerateItem(BaseModel):
    recurring_item_id: int
    ledger_transaction_id: int | None = None
    status: str


class RecurringGenerateResponse(BaseModel):
    generated: int
    skipped: int
    items: list[RecurringGenerateItem]


class BudgetResponse(BaseModel):
    id: int
    category_id: int
    category_name: str
    year: int
    month: int
    amount: Decimal
    spent: Decimal
    remaining: Decimal
    usage_rate: Decimal
    over_budget: bool


class BudgetUpsert(BaseModel):
    category_id: int
    year: int
    month: int
    amount: Decimal


class BudgetAlertItem(BaseModel):
    category_name: str
    budget: Decimal
    spent: Decimal
    over_amount: Decimal | None = None
    usage_rate: Decimal | None = None


class BudgetAlertsResponse(BaseModel):
    over_budget: list[BudgetAlertItem]
    near_limit: list[BudgetAlertItem]
