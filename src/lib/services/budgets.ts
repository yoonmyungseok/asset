import Decimal from "decimal.js";

import { serializeBudgetResponse } from "@/lib/api/serializers";
import { prisma } from "@/lib/db";
import { toDecimal } from "@/lib/decimal";
import { calculateBudgetSpent } from "@/lib/services/core";
import type { BudgetAlertItem, BudgetAlertsResponse } from "@/lib/validations/ledger";

export async function listBudgetResponses(year: number, month: number) {
  const budgets = await prisma.budget.findMany({
    where: { year, month },
    include: { category: true },
  });
  const responses = [];
  for (const budget of budgets) {
    const spent = await calculateBudgetSpent(prisma, budget.category_id, year, month);
    responses.push(serializeBudgetResponse(budget, spent));
  }
  return responses;
}

export async function getBudgetAlerts(year: number, month: number): Promise<BudgetAlertsResponse> {
  const budgets = await prisma.budget.findMany({
    where: { year, month },
    include: { category: true },
  });

  const overBudget: BudgetAlertItem[] = [];
  const nearLimit: BudgetAlertItem[] = [];

  for (const budget of budgets) {
    const spent = await calculateBudgetSpent(prisma, budget.category_id, year, month);
    const amount = toDecimal(budget.amount);
    const usageRate = amount.gt(0) ? spent.div(amount).times(100) : new Decimal(0);

    if (spent.gt(amount)) {
      overBudget.push({
        category_name: budget.category?.name ?? "",
        budget: amount,
        spent,
        over_amount: spent.minus(amount),
      });
    } else if (usageRate.gte(90)) {
      nearLimit.push({
        category_name: budget.category?.name ?? "",
        budget: amount,
        spent,
        usage_rate: usageRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      });
    }
  }

  return { over_budget: overBudget, near_limit: nearLimit };
}
