import type { Prisma, PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

import { toDecimal } from "@/lib/decimal";
import {
  applySqliteDateRange,
  monthSqliteDateBounds,
} from "@/lib/sqlite-date-filter";

type DbClient = PrismaClient | Prisma.TransactionClient;

export function prevCalendarMonth(year: number, month: number): { year: number; month: number } {
  return month > 1 ? { year, month: month - 1 } : { year: year - 1, month: 12 };
}

export function expenseChangeRate(currentExpense: Decimal, prevExpense: Decimal): Decimal {
  return prevExpense.gt(0)
    ? currentExpense.minus(prevExpense).div(prevExpense).times(100)
    : new Decimal(0);
}

export function incomeChangeRate(currentIncome: Decimal, prevIncome: Decimal): Decimal {
  return prevIncome.gt(0)
    ? currentIncome.minus(prevIncome).div(prevIncome).times(100)
    : new Decimal(0);
}

export async function aggregateMonthLedgerTotals(
  db: DbClient,
  year: number,
  month: number,
): Promise<{ income: Decimal; expense: Decimal }> {
  const { from, to } = monthSqliteDateBounds(year, month);

  const incomeAgg = await db.ledgerTransaction.aggregate({
    where: await applySqliteDateRange({ type: "income" }, "ledger_transactions", from, to),
    _sum: { amount: true },
  });
  const expenseAgg = await db.ledgerTransaction.aggregate({
    where: await applySqliteDateRange({ type: "expense" }, "ledger_transactions", from, to),
    _sum: { amount: true },
  });

  return {
    income: toDecimal(incomeAgg._sum.amount),
    expense: toDecimal(expenseAgg._sum.amount),
  };
}

export type CashflowMonthComparison = {
  prev_month_income: Decimal;
  prev_month_expense: Decimal;
  income_change_rate: Decimal;
  expense_change_rate: Decimal;
};

export async function getCashflowMonthComparison(
  db: DbClient,
  year: number,
  month: number,
  currentIncome: Decimal,
  currentExpense: Decimal,
): Promise<CashflowMonthComparison> {
  const { year: prevYear, month: prevMonth } = prevCalendarMonth(year, month);
  const prevTotals = await aggregateMonthLedgerTotals(db, prevYear, prevMonth);

  return {
    prev_month_income: prevTotals.income,
    prev_month_expense: prevTotals.expense,
    income_change_rate: incomeChangeRate(currentIncome, prevTotals.income).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    ),
    expense_change_rate: expenseChangeRate(currentExpense, prevTotals.expense).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    ),
  };
}
