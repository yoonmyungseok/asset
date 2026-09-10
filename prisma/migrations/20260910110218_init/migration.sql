-- CreateTable
CREATE TABLE "account_types" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supports_holdings" BOOLEAN NOT NULL DEFAULT false,
    "supports_contribution_limit" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_type_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "cash_balance" DECIMAL NOT NULL DEFAULT 0,
    "metadata_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounts_account_type_id_fkey" FOREIGN KEY ("account_type_id") REFERENCES "account_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "asset_class" TEXT NOT NULL DEFAULT 'stock',
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL DEFAULT 0,
    "avg_cost_price" DECIMAL NOT NULL DEFAULT 0,
    "manual_price" DECIMAL,
    "interest_rate" DECIMAL,
    "start_date" DATETIME,
    "maturity_date" DATETIME,
    "last_market_price" DECIMAL,
    "last_price_updated_at" DATETIME,
    CONSTRAINT "holdings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "investment_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "holding_id" INTEGER,
    "type" TEXT NOT NULL,
    "transaction_date" DATETIME NOT NULL,
    "quantity" DECIMAL,
    "price" DECIMAL,
    "amount" DECIMAL NOT NULL,
    "fee" DECIMAL NOT NULL DEFAULT 0,
    "memo" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investment_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "investment_transactions_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_yearly_limits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "contribution_limit" DECIMAL NOT NULL DEFAULT 0,
    "contributed_amount" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "account_yearly_limits_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parent_id" INTEGER,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "liabilities" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "original_amount" DECIMAL NOT NULL DEFAULT 0,
    "current_balance" DECIMAL NOT NULL DEFAULT 0,
    "interest_rate" DECIMAL,
    "due_day" INTEGER,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "cards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "card_type" TEXT NOT NULL,
    "institution" TEXT,
    "last_four" TEXT,
    "linked_account_id" INTEGER,
    "linked_liability_id" INTEGER,
    "settlement_account_id" INTEGER,
    "due_day" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cards_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cards_linked_liability_id_fkey" FOREIGN KEY ("linked_liability_id") REFERENCES "liabilities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cards_settlement_account_id_fkey" FOREIGN KEY ("settlement_account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "card_settlements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "card_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "settlement_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_settlements_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transaction_date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "payment_method_id" INTEGER,
    "account_id" INTEGER,
    "to_account_id" INTEGER,
    "card_id" INTEGER,
    "merchant" TEXT,
    "memo" TEXT,
    "is_fixed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ledger_transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledger_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledger_transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledger_transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ledger_transaction_tags" (
    "ledger_transaction_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    PRIMARY KEY ("ledger_transaction_id", "tag_id"),
    CONSTRAINT "ledger_transaction_tags_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "ledger_transactions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ledger_transaction_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recurring_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "payment_method_id" INTEGER,
    "account_id" INTEGER,
    "to_account_id" INTEGER,
    "card_id" INTEGER,
    "merchant" TEXT,
    "memo" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "day_of_month" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "recurring_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recurring_items_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "recurring_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "recurring_items_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "recurring_items_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "liability_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "liability_id" INTEGER NOT NULL,
    "transaction_date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "memo" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "liability_transactions_liability_id_fkey" FOREIGN KEY ("liability_id") REFERENCES "liabilities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot_date" DATETIME NOT NULL,
    "total_assets" DECIMAL NOT NULL DEFAULT 0,
    "total_liabilities" DECIMAL NOT NULL DEFAULT 0,
    "net_worth" DECIMAL NOT NULL DEFAULT 0,
    "investment_total" DECIMAL NOT NULL DEFAULT 0,
    "cash_total" DECIMAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot_date" DATETIME NOT NULL,
    "account_id" INTEGER NOT NULL,
    "balance_value" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "account_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "liability_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot_date" DATETIME NOT NULL,
    "liability_id" INTEGER NOT NULL,
    "balance_value" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "liability_snapshots_liability_id_fkey" FOREIGN KEY ("liability_id") REFERENCES "liabilities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "account_types_code_key" ON "account_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "account_yearly_limits_account_id_year_key" ON "account_yearly_limits"("account_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_name_key" ON "payment_methods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "card_settlements_card_id_year_month_key" ON "card_settlements"("card_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_category_id_year_month_key" ON "budgets"("category_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "daily_snapshots_snapshot_date_key" ON "daily_snapshots"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "account_snapshots_snapshot_date_account_id_key" ON "account_snapshots"("snapshot_date", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "liability_snapshots_snapshot_date_liability_id_key" ON "liability_snapshots"("snapshot_date", "liability_id");
