import type { Prisma, PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

import { toDecimal } from "@/lib/decimal";
import {
  applySqliteDateRange,
  monthSqliteDateBounds,
} from "@/lib/sqlite-date-filter";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type AccountOverviewForInsights = {
  category: string;
  total_value: Decimal;
};

export type DashboardInsights = {
  savings_rate: Decimal | null;
  emergency_months: Decimal | null;
  debt_ratio: Decimal | null;
};

export function sumCashCategoryAccounts(accounts: AccountOverviewForInsights[]): Decimal {
  return accounts
    .filter((account) => account.category === "cash")
    .reduce((sum, account) => sum.plus(account.total_value), new Decimal(0));
}

export function computeSavingsRate(income: Decimal, expense: Decimal): Decimal | null {
  if (income.lte(0)) {
    return null;
  }
  return income
    .minus(expense)
    .div(income)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function computeDebtRatio(
  totalLiabilities: Decimal,
  totalAssets: Decimal,
): Decimal | null {
  if (totalAssets.lte(0)) {
    return null;
  }
  return totalLiabilities
    .div(totalAssets)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function computeEmergencyMonths(
  emergencyFund: Decimal,
  avgMonthlyExpense: Decimal,
): Decimal | null {
  if (avgMonthlyExpense.lte(0)) {
    return null;
  }
  return emergencyFund.div(avgMonthlyExpense).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
}

export async function sumExpensesForRecentMonths(
  db: DbClient,
  months: number,
  refDate: Date = new Date(),
): Promise<Decimal> {
  let year = refDate.getFullYear();
  let month = refDate.getMonth() + 1;
  let total = new Decimal(0);

  for (let i = 0; i < months; i += 1) {
    const { from, to } = monthSqliteDateBounds(year, month);
    const expenseAgg = await db.ledgerTransaction.aggregate({
      where: await applySqliteDateRange({ type: "expense" }, "ledger_transactions", from, to),
      _sum: { amount: true },
    });
    total = total.plus(toDecimal(expenseAgg._sum.amount));

    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return total;
}

export async function getDashboardInsights(
  db: DbClient,
  params: {
    income: Decimal;
    expense: Decimal;
    totalAssets: Decimal;
    totalLiabilities: Decimal;
    accountsSummary: AccountOverviewForInsights[];
    asOf?: Date;
    expenseLookbackMonths?: number;
  },
): Promise<DashboardInsights> {
  const lookback = params.expenseLookbackMonths ?? 6;
  const totalExpense = await sumExpensesForRecentMonths(db, lookback, params.asOf);
  const avgMonthlyExpense = totalExpense.div(lookback);
  const emergencyFund = sumCashCategoryAccounts(params.accountsSummary);

  return {
    savings_rate: computeSavingsRate(params.income, params.expense),
    emergency_months: computeEmergencyMonths(emergencyFund, avgMonthlyExpense),
    debt_ratio: computeDebtRatio(params.totalLiabilities, params.totalAssets),
  };
}
