/**
 * Copy health-domain tables from self-care SQLite DB into the unified asset DB.
 *
 * Usage:
 *   npx tsx scripts/migrate-self-care-db.ts --source ../self-care/prisma/dev.db
 *   npx tsx scripts/migrate-self-care-db.ts --dry-run
 */
import Database from "better-sqlite3";
import path from "path";

import { resolveDatabaseFilePath } from "../src/lib/database-path";

const TABLES = [
  "UserSettings",
  "WeightRecord",
  "RunningType",
  "RunningRecord",
  "RunningSplit",
  "Meal",
  "FoodEntry",
  "FoodItem",
] as const;

function parseArgs() {
  const args = process.argv.slice(2);
  let source = path.resolve(process.cwd(), "..", "self-care", "prisma", "dev.db");
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      source = path.resolve(args[++i]);
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { source, dryRun, target: resolveDatabaseFilePath() };
}

function main() {
  const { source, dryRun, target } = parseArgs();
  console.log("Source:", source);
  console.log("Target:", target);

  const src = new Database(source, { readonly: true });
  const dst = new Database(target);

  try {
    for (const table of TABLES) {
      const exists = src
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(table);
      if (!exists) {
        console.log(`skip ${table} (not in source)`);
        continue;
      }
      const rowCount = src.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get() as { c: number };
      console.log(`${table}: ${rowCount.c} rows`);
      if (dryRun || rowCount.c === 0) continue;

      dst.exec(`DELETE FROM "${table}"`);
      const cols = (src.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(
        (c) => c.name,
      );
      const colList = cols.map((c) => `"${c}"`).join(", ");
      const placeholders = cols.map(() => "?").join(", ");
      const insert = dst.prepare(`INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`);
      const rows = src.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];

      const tx = dst.transaction((batch: Record<string, unknown>[]) => {
        for (const row of batch) {
          insert.run(...cols.map((c) => row[c]));
        }
      });
      tx(rows);
      console.log(`  -> copied ${rows.length} rows`);
    }
  } finally {
    src.close();
    dst.close();
  }

  console.log(dryRun ? "Dry run complete." : "Migration complete.");
}

main();
