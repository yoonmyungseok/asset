import { spawnSync } from "node:child_process";

import { resolveDatabaseUrl } from "../src/lib/database-path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: tsx scripts/run-prisma.ts <prisma-command> [args...]");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: resolveDatabaseUrl(),
  },
  shell: true,
});

process.exit(result.status ?? 1);
