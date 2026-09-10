import Database from "better-sqlite3";

const TABLES: Array<{ table: string; columns: string[] }> = [
  { table: "accounts", columns: ["created_at"] },
  { table: "holdings", columns: ["start_date", "maturity_date", "last_price_updated_at"] },
  { table: "investment_transactions", columns: ["transaction_date", "created_at"] },
  { table: "liabilities", columns: ["created_at"] },
  { table: "cards", columns: ["created_at"] },
  { table: "card_settlements", columns: ["settlement_date", "created_at"] },
  { table: "ledger_transactions", columns: ["transaction_date", "created_at"] },
  { table: "liability_transactions", columns: ["transaction_date", "created_at"] },
  { table: "daily_snapshots", columns: ["snapshot_date"] },
  { table: "account_snapshots", columns: ["snapshot_date"] },
  { table: "liability_snapshots", columns: ["snapshot_date"] },
];

function normalizeDateTime(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T00:00:00.000Z`;
  }
  if (raw.includes("T")) {
    const match = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d+)(Z?)$/);
    if (match) {
      const millis = match[2].padEnd(3, "0").slice(0, 3);
      return `${match[1]}.${millis}Z`;
    }
    return raw.endsWith("Z") ? raw : `${raw}Z`;
  }
  if (!raw.includes(" ")) {
    return raw;
  }
  const [date, time] = raw.split(" ");
  const [hms, fraction = "000"] = time.split(".");
  const millis = fraction.padEnd(3, "0").slice(0, 3);
  return `${date}T${hms}.${millis}Z`;
}

function main() {
  const db = new Database("data/asset.db");
  let updated = 0;

  for (const { table, columns } of TABLES) {
    const rows = db.prepare(`SELECT id, ${columns.join(", ")} FROM "${table}"`).all() as Array<
      Record<string, unknown>
    >;

    for (const row of rows) {
      const sets: string[] = [];
      const values: unknown[] = [];

      for (const column of columns) {
        const normalized = normalizeDateTime(row[column]);
        if (normalized != null && normalized !== row[column]) {
          sets.push(`${column} = ?`);
          values.push(normalized);
        }
      }

      if (sets.length === 0) {
        continue;
      }

      values.push(row.id);
      db.prepare(`UPDATE "${table}" SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      updated += 1;
    }
  }

  db.close();
  console.log(`Normalized datetime values in ${updated} row(s).`);
}

main();
