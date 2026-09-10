import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeEach } from "vitest";

import {
  resetTestDatabase,
  setTestDbPath,
  teardownTestDatabase,
} from "./helpers/test-db";

function resetPrismaSingleton(): void {
  const globalForPrisma = globalThis as typeof globalThis & {
    prisma?: { $disconnect: () => Promise<void> };
  };
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}

function createTestDatabaseFile(): void {
  const testDbPath = path.join(os.tmpdir(), `asset-test-${process.pid}.db`);
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const dbUrl = `file:${testDbPath}`;
  process.env.DATABASE_URL = dbUrl;
  process.env.NODE_ENV = "test";
  resetPrismaSingleton();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
    cwd: process.cwd(),
  });

  setTestDbPath(testDbPath);
}

createTestDatabaseFile();

beforeEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});
