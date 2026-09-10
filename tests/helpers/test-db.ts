import fs from "fs";
import path from "path";

import type { PrismaClient } from "@prisma/client";

let testDbPath: string | null = null;

const USER_TABLES = [
  "ledger_transaction_tags",
  "ledger_transactions",
  "tags",
  "investment_transactions",
  "holdings",
  "account_yearly_limits",
  "account_snapshots",
  "card_settlements",
  "cards",
  "recurring_items",
  "budgets",
  "liability_transactions",
  "liability_snapshots",
  "daily_snapshots",
  "accounts",
  "categories",
  "payment_methods",
  "account_types",
  "liabilities",
] as const;

function resetPrismaSingleton(): void {
  const globalForPrisma = globalThis as typeof globalThis & {
    prisma?: PrismaClient;
  };
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}

async function clearAllTables(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
  for (const table of USER_TABLES) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  }
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
}

export function getTestDbPath(): string {
  if (!testDbPath) {
    throw new Error("Test database has not been initialized.");
  }
  return testDbPath;
}

export function setTestDbPath(dbPath: string): void {
  testDbPath = dbPath;
}

export async function resetTestDatabase(): Promise<void> {
  const { prisma } = await import("@/lib/db");
  const { initializeAll } = await import("@/lib/services/core");

  await clearAllTables(prisma);
  await initializeAll(prisma);
}

export async function teardownTestDatabase(): Promise<void> {
  const { prisma } = await import("@/lib/db");
  await prisma.$disconnect();
  resetPrismaSingleton();

  if (testDbPath && fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    testDbPath = null;
  }
}

export function resolveTestDbPathFromEnv(): string {
  const configured = process.env.DATABASE_URL;
  if (!configured?.startsWith("file:")) {
    throw new Error("DATABASE_URL must be set to a SQLite file URL for tests.");
  }
  const filePath = configured.slice("file:".length);
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}
