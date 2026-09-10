import Database from "better-sqlite3";

const TABLES = [
  "accounts",
  "holdings",
  "investment_transactions",
  "account_yearly_limits",
  "liabilities",
  "card_settlements",
  "ledger_transactions",
  "recurring_items",
  "budgets",
  "liability_transactions",
  "daily_snapshots",
  "account_snapshots",
  "liability_snapshots",
] as const;

function mapColumnType(type: string, name: string, isPk: boolean): string {
  if (isPk) {
    return "INTEGER PRIMARY KEY";
  }
  if (type.startsWith("NUMERIC") || type === "DECIMAL") {
    return "DECIMAL";
  }
  if (type === "DATETIME" || type === "DATE") {
    return "DATETIME";
  }
  if (type.startsWith("VARCHAR")) {
    return "TEXT";
  }
  if (type === "BOOLEAN") {
    return "BOOLEAN";
  }
  if (type === "INTEGER") {
    return "INTEGER";
  }
  if (type === "JSON") {
    return "JSONB";
  }
  return type || "TEXT";
}

function getTableIndexes(db: Database.Database, table: string): string[] {
  const rows = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL",
    )
    .all(table) as Array<{ sql: string }>;
  return rows.map((row) => row.sql);
}

function main() {
  const db = new Database("data/asset.db");

  for (const table of TABLES) {
    const info = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    if (info.length === 0) {
      continue;
    }

    const needsFix = info.some((column) => column.type.startsWith("NUMERIC("));
    if (!needsFix) {
      console.log(`Skip ${table}`);
      continue;
    }

    const columnDefs = info
      .map((column) => {
        const type = mapColumnType(column.type, column.name, column.pk === 1);
        const notNull = column.notnull ? " NOT NULL" : "";
        const defaultValue =
          column.dflt_value == null ? "" : ` DEFAULT ${column.dflt_value}`;
        return `"${column.name}" ${type}${notNull}${defaultValue}`;
      })
      .join(", ");

    const indexes = getTableIndexes(db, table);
    const tempTable = `${table}__prisma_fix`;
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec(`DROP TABLE IF EXISTS "${tempTable}"`);
    db.exec(`CREATE TABLE "${tempTable}" (${columnDefs})`);
    db.exec(`INSERT INTO "${tempTable}" SELECT * FROM "${table}"`);
    db.exec(`DROP TABLE "${table}"`);
    db.exec(`ALTER TABLE "${tempTable}" RENAME TO "${table}"`);
    for (const indexSql of indexes) {
      db.exec(indexSql);
    }
    db.exec("PRAGMA foreign_keys = ON");

    console.log(`Fixed ${table}`);
  }

  db.close();
}

main();
