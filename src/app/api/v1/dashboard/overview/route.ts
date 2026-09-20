import Decimal from "decimal.js";

import { formatDateOnly, handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  monthSqliteDateBounds,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";
import { getBudgetAlerts } from "@/lib/services/budgets";
import { getDashboardInsights } from "@/lib/services/dashboard-insights";
import {
  getDashboardCashflowComparison,
  getDashboardLimitAlerts,
  getNetWorthDelta,
} from "@/lib/services/dashboard-overview";
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
    const asOf = new Date();
    const netWorthDelta = await getNetWorthDelta(prisma, totals.net_worth, asOf);
    const cashflowComparison = await getDashboardCashflowComparison(
      prisma,
      today.getFullYear(),
      today.getMonth() + 1,
      income,
      expense,
    );
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
    const budgetAlerts = alerts.over_budget.map((item) => ({
      category_name: item.category_name,
      budget: item.budget,
      spent: item.spent,
      over_amount: item.over_amount,
    }));
    const limitAlerts = await getDashboardLimitAlerts(prisma, today.getFullYear());
    const insights = await getDashboardInsights(prisma, {
      income,
      expense,
      totalAssets,
      totalLiabilities: totals.total_liabilities,
      accountsSummary: accountsSummary.map((item) => ({
        category: item.category,
        total_value: item.total_value,
      })),
      asOf: asOf,
    });

    return jsonOk({
      as_of: asOf,
      net_worth: {
        total_assets: totals.total_assets,
        total_liabilities: totals.total_liabilities,
        net_worth: totals.net_worth,
      },
      net_worth_delta: netWorthDelta
        ? {
            previous_date: formatDateOnly(netWorthDelta.previous_date),
            change_amount: netWorthDelta.change_amount,
            change_rate: netWorthDelta.change_rate,
          }
        : null,
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
      cashflow_comparison: {
        prev_month_income: cashflowComparison.prev_month_income,
        prev_month_expense: cashflowComparison.prev_month_expense,
        income_change_rate: cashflowComparison.income_change_rate,
        expense_change_rate: cashflowComparison.expense_change_rate,
      },
      accounts_summary: accountsSummary,
      budget_alerts: budgetAlerts,
      budget_alerts_count: budgetAlerts.length,
      limit_alerts: limitAlerts,
      insights,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
