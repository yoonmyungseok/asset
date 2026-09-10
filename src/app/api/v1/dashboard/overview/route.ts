import Decimal from "decimal.js";

import { handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  monthSqliteDateBounds,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";
import { getBudgetAlerts } from "@/lib/services/budgets";
import { aggregateAssets, getAccountTotalValue } from "@/lib/services/core";

export async function GET() {
  try {
    const totals = await aggregateAssets(prisma);
    const today = new Date();
    const { from, to } = monthSqliteDateBounds(today.getFullYear(), today.getMonth() + 1);

    const incomeAgg = await prisma.ledgerTransaction.aggregate({
      where: await applySqliteDateRange({ type: "income" }, "ledger_transactions", from, to),
      _sum: { amount: true },
    });
    const expenseAgg = await prisma.ledgerTransaction.aggregate({
      where: await applySqliteDateRange({ type: "expense" }, "ledger_transactions", from, to),
      _sum: { amount: true },
    });

    const income = toDecimal(incomeAgg._sum.amount);
    const expense = toDecimal(expenseAgg._sum.amount);
    const totalAssets = totals.total_assets;
    const investmentRatio = totalAssets.gt(0)
      ? totals.investment_total.div(totalAssets).times(100)
      : new Decimal(0);
    const cashRatio = totalAssets.gt(0)
      ? totals.cash_total.div(totalAssets).times(100)
      : new Decimal(0);

    const accounts = await prisma.account.findMany({
      where: { is_active: true },
      include: { account_type: true },
    });

    const accountsSummary = [];
    for (const account of accounts) {
      const value = await getAccountTotalValue(prisma, account);
      const ratio = totalAssets.gt(0) ? value.div(totalAssets).times(100) : new Decimal(0);
      accountsSummary.push({
        account_id: account.id,
        name: account.name,
        type: account.account_type.name,
        category: account.account_type.category,
        total_value: value,
        ratio: ratio.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      });
    }
    accountsSummary.sort((a, b) => b.ratio.comparedTo(a.ratio));

    const alerts = await getBudgetAlerts(today.getFullYear(), today.getMonth() + 1);
    const limitRows = await prisma.accountYearlyLimit.findMany({
      where: { year: today.getFullYear() },
      include: { account: true },
    });

    const limitAlerts = [];
    for (const row of limitRows) {
      if (!row.account || !row.account.is_active) {
        continue;
      }
      const limit = toDecimal(row.contribution_limit);
      if (limit.lte(0)) {
        continue;
      }
      const contributed = toDecimal(row.contributed_amount);
      const remaining = limit.minus(contributed);
      const usageRate = contributed.div(limit).times(100);
      limitAlerts.push({
        account_name: row.account.name,
        usage_rate: usageRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        remaining,
      });
    }

    return jsonOk({
      as_of: new Date(),
      net_worth: {
        total_assets: totals.total_assets,
        total_liabilities: totals.total_liabilities,
        net_worth: totals.net_worth,
      },
      asset_breakdown: {
        investment: totals.investment_total,
        cash: totals.cash_total,
        investment_ratio: investmentRatio.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        cash_ratio: cashRatio.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      },
      cashflow: {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        total_income: income,
        total_expense: expense,
        net: income.minus(expense),
      },
      accounts_summary: accountsSummary,
      budget_alerts_count: alerts.over_budget.length,
      limit_alerts: limitAlerts,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
