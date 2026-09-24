import { Prisma, type PrismaClient } from "@prisma/client";

import { ServiceError } from "@/lib/service-error";
import { prisma } from "@/lib/db";

type DbClient = PrismaClient | Prisma.TransactionClient;

const DATE_RANGE_TABLES = {
  ledger_transactions: "transaction_date",
  investment_transactions: "transaction_date",
  daily_snapshots: "snapshot_date",
  account_snapshots: "snapshot_date",
  liability_snapshots: "snapshot_date",
} as const;

type DateRangeTable = keyof typeof DATE_RANGE_TABLES;

const ISO_DATE_TIME_BOUND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDateTimeBound(value: string, label: string): void {
  if (!ISO_DATE_TIME_BOUND.test(value)) {
    throw new ServiceError(422, `Invalid ${label} date bound: ${value}`);
  }
}

function toDateOnly(value: string): string {
  assertIsoDateTimeBound(value, "query");
  return value.slice(0, 10);
}

function assertDateOnly(value: string, label: string): void {
  if (!ISO_DATE_ONLY.test(value)) {
    throw new ServiceError(422, `Invalid ${label} date: ${value}`);
  }
}

export function toSqliteDateTimeParam(date: Date): string {
  return date.toISOString();
}

export function parseQueryDateBound(
  value: string | null,
  bound: "start" | "end",
): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return bound === "start"
      ? `${trimmed}T00:00:00.000Z`
      : `${trimmed}T23:59:59.999Z`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new ServiceError(422, `Invalid date: ${value}`);
  }
  return toSqliteDateTimeParam(parsed);
}

export function monthSqliteDateBounds(year: number, month: number): {
  from: string;
  to: string;
} {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const dd = String(lastDay).padStart(2, "0");
  const prefix = `${year}-${mm}`;
  return {
    from: `${prefix}-01T00:00:00.000Z`,
    to: `${prefix}-${dd}T23:59:59.999Z`,
  };
}

export async function findIdsInDateRange(
  table: DateRangeTable,
  from?: string,
  to?: string,
  db: DbClient = prisma,
): Promise<number[] | null> {
  if (!from && !to) {
    return null;
  }

  const column = DATE_RANGE_TABLES[table];
  const fromDate = from ? toDateOnly(from) : undefined;
  const toDate = to ? toDateOnly(to) : undefined;
  if (fromDate) {
    assertDateOnly(fromDate, "from");
  }
  if (toDate) {
    assertDateOnly(toDate, "to");
  }

  const fromMs = from ? Date.parse(from) : undefined;
  const toMs = to ? Date.parse(to) : undefined;
  const textRange =
    fromDate && toDate
      ? `(typeof("${column}") = 'text' AND substr("${column}", 1, 10) >= '${fromDate}' AND substr("${column}", 1, 10) <= '${toDate}')`
      : fromDate
        ? `(typeof("${column}") = 'text' AND substr("${column}", 1, 10) >= '${fromDate}')`
        : toDate
          ? `(typeof("${column}") = 'text' AND substr("${column}", 1, 10) <= '${toDate}')`
          : null;
  const integerRange =
    fromMs != null && toMs != null
      ? `(typeof("${column}") = 'integer' AND "${column}" >= ${fromMs} AND "${column}" <= ${toMs})`
      : fromMs != null
        ? `(typeof("${column}") = 'integer' AND "${column}" >= ${fromMs})`
        : toMs != null
          ? `(typeof("${column}") = 'integer' AND "${column}" <= ${toMs})`
          : null;

  const branches = [textRange, integerRange].filter((branch): branch is string => branch != null);
  const sql = `SELECT id FROM "${table}" WHERE (${branches.join(" OR ")})`;
  const rows = await db.$queryRawUnsafe<Array<{ id: number }>>(sql);
  return rows.map((row) => row.id);
}

export async function applySqliteDateRange<T extends Record<string, unknown>>(
  where: T,
  table: DateRangeTable,
  from?: string,
  to?: string,
  db: DbClient = prisma,
): Promise<T> {
  const ids = await findIdsInDateRange(table, from, to, db);
  if (ids == null) {
    return where;
  }
  return {
    ...where,
    id: { in: ids },
  };
}
