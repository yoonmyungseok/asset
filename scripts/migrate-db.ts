import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

import { Prisma, PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";

const TABLES = [
  "account_types",
  "categories",
  "payment_methods",
  "accounts",
  "holdings",
  "investment_transactions",
  "liabilities",
  "cards",
  "card_settlements",
  "ledger_transactions",
  "tags",
  "ledger_transaction_tags",
  "recurring_items",
  "budgets",
  "daily_snapshots",
  "account_snapshots",
  "liability_snapshots",
  "account_yearly_limits",
  "liability_transactions",
] as const;

type TableName = (typeof TABLES)[number];

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const sourceIdx = args.indexOf("--source");
  const source =
    sourceIdx >= 0 && args[sourceIdx + 1]
      ? args[sourceIdx + 1]
      : resolveDefaultSource();
  return { dryRun, source };
}

function resolveDefaultSource(): string {
  const backup = path.join("data", "asset.db.pre-migration.bak");
  const current = path.join("data", "asset.db");
  if (existsSync(backup)) {
    return backup;
  }
  return current;
}

function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (!configured) {
    return path.join(process.cwd(), "data", "asset.db");
  }
  if (configured.startsWith("file:./")) {
    const relativePath = configured.slice("file:".length);
    return path.join(process.cwd(), relativePath);
  }
  if (configured.startsWith("file:")) {
    return configured.slice("file:".length);
  }
  return configured;
}

function countRows(db: Database.Database, table: TableName): number {
  const row = db.prepare(`SELECT COUNT(*) as n FROM "${table}"`).get() as { n: number };
  return row.n;
}

function printCounts(label: string, counts: Record<string, number>) {
  console.log(`\n${label}`);
  for (const table of TABLES) {
    console.log(`  ${table}: ${counts[table] ?? 0}`);
  }
}

function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

function toDate(value: unknown): Date | null {
  if (value == null || value === "") {
    return null;
  }
  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDecimal(value: unknown): Prisma.Decimal | null {
  if (value == null || value === "") {
    return null;
  }
  return new Prisma.Decimal(String(value));
}

function toRequiredDecimal(value: unknown): Prisma.Decimal {
  return new Prisma.Decimal(value == null || value === "" ? "0" : String(value));
}

function parseMetadata(value: unknown): Prisma.InputJsonValue | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "object") {
    return value as Prisma.InputJsonValue;
  }
  try {
    return JSON.parse(String(value)) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

function backupTargetDb(targetPath: string) {
  if (!existsSync(targetPath)) {
    return;
  }
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${targetPath}.pre-import.${stamp}.bak`;
  copyFileSync(targetPath, backupPath);
  console.log(`Backed up target DB to ${backupPath}`);
}

async function countPrismaTables(prisma: PrismaClient): Promise<Record<string, number>> {
  const [
    account_types,
    categories,
    payment_methods,
    accounts,
    holdings,
    investment_transactions,
    liabilities,
    cards,
    card_settlements,
    ledger_transactions,
    tags,
    ledger_transaction_tags,
    recurring_items,
    budgets,
    daily_snapshots,
    account_snapshots,
    liability_snapshots,
    account_yearly_limits,
    liability_transactions,
  ] = await Promise.all([
    prisma.accountType.count(),
    prisma.category.count(),
    prisma.paymentMethod.count(),
    prisma.account.count(),
    prisma.holding.count(),
    prisma.investmentTransaction.count(),
    prisma.liability.count(),
    prisma.card.count(),
    prisma.cardSettlement.count(),
    prisma.ledgerTransaction.count(),
    prisma.tag.count(),
    prisma.ledgerTransactionTag.count(),
    prisma.recurringItem.count(),
    prisma.budget.count(),
    prisma.dailySnapshot.count(),
    prisma.accountSnapshot.count(),
    prisma.liabilitySnapshot.count(),
    prisma.accountYearlyLimit.count(),
    prisma.liabilityTransaction.count(),
  ]);

  return {
    account_types,
    categories,
    payment_methods,
    accounts,
    holdings,
    investment_transactions,
    liabilities,
    cards,
    card_settlements,
    ledger_transactions,
    tags,
    ledger_transaction_tags,
    recurring_items,
    budgets,
    daily_snapshots,
    account_snapshots,
    liability_snapshots,
    account_yearly_limits,
    liability_transactions,
  };
}

async function clearTargetTables(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.ledgerTransactionTag.deleteMany(),
    prisma.liabilityTransaction.deleteMany(),
    prisma.accountYearlyLimit.deleteMany(),
    prisma.liabilitySnapshot.deleteMany(),
    prisma.accountSnapshot.deleteMany(),
    prisma.dailySnapshot.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.recurringItem.deleteMany(),
    prisma.ledgerTransaction.deleteMany(),
    prisma.cardSettlement.deleteMany(),
    prisma.card.deleteMany(),
    prisma.investmentTransaction.deleteMany(),
    prisma.holding.deleteMany(),
    prisma.account.deleteMany(),
    prisma.liability.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.paymentMethod.deleteMany(),
    prisma.category.deleteMany({ where: { parent_id: { not: null } } }),
    prisma.category.deleteMany(),
    prisma.accountType.deleteMany(),
  ]);
}

async function importData(sourcePath: string, prisma: PrismaClient) {
  await clearTargetTables(prisma);
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");

  const source = new Database(sourcePath, { readonly: true });

  const accountTypes = source.prepare("SELECT * FROM account_types ORDER BY id").all();
  if (accountTypes.length > 0) {
    await prisma.accountType.createMany({
      data: accountTypes.map((row) => ({
        id: Number(row.id),
        code: String(row.code),
        name: String(row.name),
        category: String(row.category),
        supports_holdings: toBool(row.supports_holdings),
        supports_contribution_limit: toBool(row.supports_contribution_limit),
        sort_order: Number(row.sort_order),
        is_system: toBool(row.is_system),
      })),
    });
  }

  const categories = source.prepare("SELECT * FROM categories ORDER BY id").all();
  if (categories.length > 0) {
    await prisma.category.createMany({
      data: categories.map((row) => ({
        id: Number(row.id),
        parent_id: row.parent_id == null ? null : Number(row.parent_id),
        name: String(row.name),
        type: String(row.type),
        sort_order: Number(row.sort_order),
        is_system: toBool(row.is_system),
        is_active: toBool(row.is_active),
      })),
    });
  }

  const paymentMethods = source.prepare("SELECT * FROM payment_methods ORDER BY id").all();
  if (paymentMethods.length > 0) {
    await prisma.paymentMethod.createMany({
      data: paymentMethods.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        is_system: toBool(row.is_system),
      })),
    });
  }

  const accounts = source.prepare("SELECT * FROM accounts ORDER BY id").all();
  if (accounts.length > 0) {
    await prisma.account.createMany({
      data: accounts.map((row) => ({
        id: Number(row.id),
        account_type_id: Number(row.account_type_id),
        name: String(row.name),
        institution: row.institution == null ? null : String(row.institution),
        cash_balance: toRequiredDecimal(row.cash_balance),
        metadata_json: parseMetadata(row.metadata_json),
        is_active: toBool(row.is_active),
        created_at: toDate(row.created_at) ?? new Date(),
      })),
    });
  }

  const holdings = source.prepare("SELECT * FROM holdings ORDER BY id").all();
  if (holdings.length > 0) {
    await prisma.holding.createMany({
      data: holdings.map((row) => ({
        id: Number(row.id),
        account_id: Number(row.account_id),
        asset_class: row.asset_class == null ? "stock" : String(row.asset_class),
        symbol: String(row.symbol),
        name: String(row.name),
        quantity: toRequiredDecimal(row.quantity),
        avg_cost_price: toRequiredDecimal(row.avg_cost_price),
        manual_price: toDecimal(row.manual_price),
        interest_rate: toDecimal(row.interest_rate),
        start_date: toDate(row.start_date),
        maturity_date: toDate(row.maturity_date),
        last_market_price: toDecimal(row.last_market_price),
        last_price_updated_at: toDate(row.last_price_updated_at),
      })),
    });
  }

  const investmentTransactions = source
    .prepare("SELECT * FROM investment_transactions ORDER BY id")
    .all();
  if (investmentTransactions.length > 0) {
    await prisma.investmentTransaction.createMany({
      data: investmentTransactions.map((row) => ({
        id: Number(row.id),
        account_id: Number(row.account_id),
        holding_id: row.holding_id == null ? null : Number(row.holding_id),
        type: String(row.type),
        transaction_date: toDate(row.transaction_date)!,
        quantity: toDecimal(row.quantity),
        price: toDecimal(row.price),
        amount: toRequiredDecimal(row.amount),
        fee: toRequiredDecimal(row.fee),
        memo: row.memo == null ? null : String(row.memo),
        created_at: toDate(row.created_at) ?? new Date(),
      })),
    });
  }

  const liabilities = source.prepare("SELECT * FROM liabilities ORDER BY id").all();
  if (liabilities.length > 0) {
    await prisma.liability.createMany({
      data: liabilities.map((row) => ({
        id: Number(row.id),
        type: String(row.type),
        name: String(row.name),
        institution: row.institution == null ? null : String(row.institution),
        original_amount: toRequiredDecimal(row.original_amount),
        current_balance: toRequiredDecimal(row.current_balance),
        interest_rate: toDecimal(row.interest_rate),
        due_day: row.due_day == null ? null : Number(row.due_day),
        notes: row.notes == null ? null : String(row.notes),
        is_active: toBool(row.is_active),
        created_at: toDate(row.created_at) ?? new Date(),
      })),
    });
  }

  const cards = source.prepare("SELECT * FROM cards ORDER BY id").all();
  if (cards.length > 0) {
    await prisma.card.createMany({
      data: cards.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        card_type: String(row.card_type),
        institution: row.institution == null ? null : String(row.institution),
        last_four: row.last_four == null ? null : String(row.last_four),
        linked_account_id: row.linked_account_id == null ? null : Number(row.linked_account_id),
        linked_liability_id:
          row.linked_liability_id == null ? null : Number(row.linked_liability_id),
        settlement_account_id:
          row.settlement_account_id == null ? null : Number(row.settlement_account_id),
        due_day: row.due_day == null ? null : Number(row.due_day),
        is_active: toBool(row.is_active),
        created_at: toDate(row.created_at) ?? new Date(),
      })),
    });
  }

  const cardSettlements = source.prepare("SELECT * FROM card_settlements ORDER BY id").all();
  if (cardSettlements.length > 0) {
    await prisma.cardSettlement.createMany({
      data: cardSettlements.map((row) => ({
        id: Number(row.id),
        card_id: Number(row.card_id),
        year: Number(row.year),
        month: Number(row.month),
        amount: toRequiredDecimal(row.amount),
        settlement_date: toDate(row.settlement_date)!,
        created_at: toDate(row.created_at) ?? new Date(),
      })),
    });
  }

  const ledgerTransactions = source.prepare("SELECT * FROM ledger_transactions ORDER BY id").all();
  if (ledgerTransactions.length > 0) {
    await prisma.ledgerTransaction.createMany({
      data: ledgerTransactions.map((row) => ({
        id: Number(row.id),
        transaction_date: toDate(row.transaction_date)!,
        type: String(row.type),
        amount: toRequiredDecimal(row.amount),
        category_id: Number(row.category_id),
        payment_method_id:
          row.payment_method_id == null ? null : Number(row.payment_method_id),
        account_id: row.account_id == null ? null : Number(row.account_id),
        to_account_id: row.to_account_id == null ? null : Number(row.to_account_id),
        card_id: row.card_id == null ? null : Number(row.card_id),
        merchant: row.merchant == null ? null : String(row.merchant),
        memo: row.memo == null ? null : String(row.memo),
        is_fixed: toBool(row.is_fixed),
        created_at: toDate(row.created_at) ?? new Date(),
      })),
    });
  }

  const tags = source.prepare("SELECT * FROM tags ORDER BY id").all();
  if (tags.length > 0) {
    await prisma.tag.createMany({
      data: tags.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
      })),
    });
  }

  const ledgerTransactionTags = source
    .prepare("SELECT * FROM ledger_transaction_tags")
    .all();
  if (ledgerTransactionTags.length > 0) {
    await prisma.ledgerTransactionTag.createMany({
      data: ledgerTransactionTags.map((row) => ({
        ledger_transaction_id: Number(row.ledger_transaction_id),
        tag_id: Number(row.tag_id),
      })),
    });
  }

  const recurringItems = source.prepare("SELECT * FROM recurring_items ORDER BY id").all();
  if (recurringItems.length > 0) {
    await prisma.recurringItem.createMany({
      data: recurringItems.map((row) => ({
        id: Number(row.id),
        type: String(row.type),
        amount: toRequiredDecimal(row.amount),
        category_id: Number(row.category_id),
        payment_method_id:
          row.payment_method_id == null ? null : Number(row.payment_method_id),
        account_id: row.account_id == null ? null : Number(row.account_id),
        to_account_id: row.to_account_id == null ? null : Number(row.to_account_id),
        card_id: row.card_id == null ? null : Number(row.card_id),
        merchant: row.merchant == null ? null : String(row.merchant),
        memo: row.memo == null ? null : String(row.memo),
        frequency: row.frequency == null ? "monthly" : String(row.frequency),
        day_of_month: Number(row.day_of_month),
        is_active: toBool(row.is_active),
      })),
    });
  }

  const budgets = source.prepare("SELECT * FROM budgets ORDER BY id").all();
  if (budgets.length > 0) {
    await prisma.budget.createMany({
      data: budgets.map((row) => ({
        id: Number(row.id),
        category_id: Number(row.category_id),
        year: Number(row.year),
        month: Number(row.month),
        amount: toRequiredDecimal(row.amount),
      })),
    });
  }

  const dailySnapshots = source.prepare("SELECT * FROM daily_snapshots ORDER BY id").all();
  if (dailySnapshots.length > 0) {
    await prisma.dailySnapshot.createMany({
      data: dailySnapshots.map((row) => ({
        id: Number(row.id),
        snapshot_date: toDate(row.snapshot_date)!,
        total_assets: toRequiredDecimal(row.total_assets),
        total_liabilities: toRequiredDecimal(row.total_liabilities),
        net_worth: toRequiredDecimal(row.net_worth),
        investment_total: toRequiredDecimal(row.investment_total),
        cash_total: toRequiredDecimal(row.cash_total),
      })),
    });
  }

  const accountSnapshots = source.prepare("SELECT * FROM account_snapshots ORDER BY id").all();
  if (accountSnapshots.length > 0) {
    await prisma.accountSnapshot.createMany({
      data: accountSnapshots.map((row) => ({
        id: Number(row.id),
        snapshot_date: toDate(row.snapshot_date)!,
        account_id: Number(row.account_id),
        balance_value: toRequiredDecimal(row.balance_value),
      })),
    });
  }

  const liabilitySnapshots = source
    .prepare("SELECT * FROM liability_snapshots ORDER BY id")
    .all();
  if (liabilitySnapshots.length > 0) {
    await prisma.liabilitySnapshot.createMany({
      data: liabilitySnapshots.map((row) => ({
        id: Number(row.id),
        snapshot_date: toDate(row.snapshot_date)!,
        liability_id: Number(row.liability_id),
        balance_value: toRequiredDecimal(row.balance_value),
      })),
    });
  }

  const accountYearlyLimits = source
    .prepare("SELECT * FROM account_yearly_limits ORDER BY id")
    .all();
  if (accountYearlyLimits.length > 0) {
    await prisma.accountYearlyLimit.createMany({
      data: accountYearlyLimits.map((row) => ({
        id: Number(row.id),
        account_id: Number(row.account_id),
        year: Number(row.year),
        contribution_limit: toRequiredDecimal(row.contribution_limit),
        contributed_amount: toRequiredDecimal(row.contributed_amount),
      })),
    });
  }

  const liabilityTransactions = source
    .prepare("SELECT * FROM liability_transactions ORDER BY id")
    .all();
  if (liabilityTransactions.length > 0) {
    await prisma.liabilityTransaction.createMany({
      data: liabilityTransactions.map((row) => ({
        id: Number(row.id),
        liability_id: Number(row.liability_id),
        transaction_date: toDate(row.transaction_date)!,
        type: String(row.type),
        amount: toRequiredDecimal(row.amount),
        memo: row.memo == null ? null : String(row.memo),
        created_at: toDate(row.created_at) ?? new Date(),
      })),
    });
  }

  source.close();
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
}

async function main() {
  const { dryRun, source } = parseArgs();
  const sourcePath = path.isAbsolute(source) ? source : path.join(process.cwd(), source);

  if (!existsSync(sourcePath)) {
    console.error(`Source database not found: ${sourcePath}`);
    process.exit(1);
  }

  const sourceDb = new Database(sourcePath, { readonly: true });
  const sourceCounts = Object.fromEntries(
    TABLES.map((table) => [table, countRows(sourceDb, table)]),
  ) as Record<string, number>;
  sourceDb.close();

  printCounts(`Source (${sourcePath})`, sourceCounts);

  if (dryRun) {
    return;
  }

  const targetPath = resolveDatabaseUrl();
  backupTargetDb(targetPath);

  const prisma = new PrismaClient();
  try {
    await importData(sourcePath, prisma);
    const targetCounts = await countPrismaTables(prisma);

    printCounts("Target (Prisma)", targetCounts);

    let mismatches = 0;
    for (const table of TABLES) {
      if (sourceCounts[table] !== targetCounts[table]) {
        console.error(
          `MISMATCH ${table}: source=${sourceCounts[table]} target=${targetCounts[table]}`,
        );
        mismatches += 1;
      }
    }

    if (mismatches > 0) {
      console.error(`\nImport completed with ${mismatches} table count mismatch(es).`);
      process.exit(1);
    }

    console.log("\nImport completed successfully. All table counts match.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
