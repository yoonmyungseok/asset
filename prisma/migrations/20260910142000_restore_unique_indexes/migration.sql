-- Restore unique indexes dropped by table-recreation scripts (e.g. fix-decimal-schema.ts)

CREATE UNIQUE INDEX IF NOT EXISTS "account_types_code_key" ON "account_types"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "account_yearly_limits_account_id_year_key" ON "account_yearly_limits"("account_id", "year");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_name_key" ON "payment_methods"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "card_settlements_card_id_year_month_key" ON "card_settlements"("card_id", "year", "month");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_name_key" ON "tags"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "budgets_category_id_year_month_key" ON "budgets"("category_id", "year", "month");
CREATE UNIQUE INDEX IF NOT EXISTS "daily_snapshots_snapshot_date_key" ON "daily_snapshots"("snapshot_date");
CREATE UNIQUE INDEX IF NOT EXISTS "account_snapshots_snapshot_date_account_id_key" ON "account_snapshots"("snapshot_date", "account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "liability_snapshots_snapshot_date_liability_id_key" ON "liability_snapshots"("snapshot_date", "liability_id");
