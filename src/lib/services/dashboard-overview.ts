import type { Prisma, PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

import { toDecimal } from "@/lib/decimal";
import { getCashflowMonthComparison } from "@/lib/services/ledger-comparison";
import { normalizeChartDate } from "@/lib/utils/format";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const LIMIT_ALERT_THRESHOLD = 80;

export type DashboardLimitAlert = {
  account_name: string;
  usage_rate: Decimal;
  remaining: Decimal;
};

export async function getDashboardLimitAlerts(
  db: DbClient,
  year: number,
): Promise<DashboardLimitAlert[]> {
  const limitRows = await db.accountYearlyLimit.findMany({
    where: { year },
    include: { account: true },
  });

  const limitAlerts: DashboardLimitAlert[] = [];
  for (const row of limitRows) {
    if (!row.account || !row.account.is_active) {
      continue;
    }
    const limit = toDecimal(row.contribution_limit);
    if (limit.lte(0)) {
      continue;
    }
    const contributed = toDecimal(row.contributed_amount);
    const usageRate = contributed.div(limit).times(100);
    if (usageRate.lt(LIMIT_ALERT_THRESHOLD)) {
      continue;
    }
    limitAlerts.push({
      account_name: row.account.name,
      usage_rate: usageRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      remaining: limit.minus(contributed),
    });
  }
  return limitAlerts;
}

export type NetWorthDelta = {
  previous_date: Date;
  change_amount: Decimal;
  change_rate: Decimal;
};

export async function getNetWorthDelta(
  db: DbClient,
  currentNetWorth: Decimal,
  asOf: Date = new Date(),
): Promise<NetWorthDelta | null> {
  const snapshotCount = await db.dailySnapshot.count();
  if (snapshotCount <= 1) {
    return null;
  }

  const today = normalizeChartDate(asOf);
  const previous = await db.dailySnapshot.findFirst({
    where: { snapshot_date: { lt: today } },
    orderBy: { snapshot_date: "desc" },
  });

  if (!previous) {
    return null;
  }

  const prevNet = toDecimal(previous.net_worth);
  const changeAmount = currentNetWorth.minus(prevNet);
  const changeRate = prevNet.gt(0)
    ? changeAmount.div(prevNet).times(100)
    : new Decimal(0);

  return {
    previous_date: previous.snapshot_date,
    change_amount: changeAmount,
    change_rate: changeRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  };
}

export async function getDashboardCashflowComparison(
  db: DbClient,
  year: number,
  month: number,
  currentIncome: Decimal,
  currentExpense: Decimal,
) {
  return getCashflowMonthComparison(db, year, month, currentIncome, currentExpense);
}
