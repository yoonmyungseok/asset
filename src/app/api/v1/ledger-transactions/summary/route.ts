import type { NextRequest } from "next/server";
import Decimal from "decimal.js";

import {
  handleRouteError,
  jsonOk,
  parseRequiredQueryInt,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  monthSqliteDateBounds,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";
import { getCategoryDescendantIds } from "@/lib/services/core";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const year = parseRequiredQueryInt(params.get("year"), "year");
    const month = parseRequiredQueryInt(params.get("month"), "month");
    const groupBy = params.get("group_by") ?? "category";
    const { from, to } = monthSqliteDateBounds(year, month);

    const incomeAgg = await prisma.ledgerTransaction.aggregate({
      where: await applySqliteDateRange({ type: "income" }, "ledger_transactions", from, to),
      _sum: { amount: true },
    });
    const expenseAgg = await prisma.ledgerTransaction.aggregate({
      where: await applySqliteDateRange({ type: "expense" }, "ledger_transactions", from, to),
      _sum: { amount: true },
    });

    const incomeTotal = toDecimal(incomeAgg._sum.amount);
    const expenseTotal = toDecimal(expenseAgg._sum.amount);

    const byCategory = [];
    if (groupBy === "category") {
      const parents = await prisma.category.findMany({
        where: { parent_id: null, type: "expense", is_active: true },
      });

      for (const parent of parents) {
        const ids = await getCategoryDescendantIds(prisma, parent.id);
        const amountAgg = await prisma.ledgerTransaction.aggregate({
          where: await applySqliteDateRange(
            {
              type: "expense",
              category_id: { in: ids },
            },
            "ledger_transactions",
            from,
            to,
          ),
          _sum: { amount: true },
        });
        const amount = toDecimal(amountAgg._sum.amount);
        const ratio = expenseTotal.gt(0)
          ? amount.div(expenseTotal).times(100)
          : new Decimal(0);

        const budget = await prisma.budget.findFirst({
          where: { category_id: parent.id, year, month },
        });
        const budgetAmount = budget ? toDecimal(budget.amount) : null;
        const overBudget = budgetAmount != null && amount.gt(budgetAmount);

        byCategory.push({
          category_id: parent.id,
          category_name: parent.name,
          parent_name: null,
          amount,
          ratio: ratio.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          budget: budgetAmount,
          over_budget: overBudget,
        });
      }
    }

    const cardGroups = await prisma.ledgerTransaction.groupBy({
      by: ["card_id"],
      where: await applySqliteDateRange(
        {
          type: "expense",
          card_id: { not: null },
        },
        "ledger_transactions",
        from,
        to,
      ),
      _sum: { amount: true },
    });

    const cardIds = cardGroups
      .map((row) => row.card_id)
      .filter((id): id is number => id != null);
    const cards = cardIds.length
      ? await prisma.card.findMany({ where: { id: { in: cardIds } } })
      : [];
    const cardsById = new Map(cards.map((card) => [card.id, card]));

    const byCard = cardGroups
      .filter((row) => row.card_id != null)
      .map((row) => {
        const card = cardsById.get(row.card_id!);
        if (!card) {
          return null;
        }
        const amount = toDecimal(row._sum.amount);
        const ratio = expenseTotal.gt(0)
          ? amount.div(expenseTotal).times(100)
          : new Decimal(0);
        return {
          card_id: card.id,
          card_name: card.name,
          card_type: card.card_type,
          institution: card.institution,
          last_four: card.last_four,
          amount,
          ratio: ratio.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((a, b) => b.amount.comparedTo(a.amount));

    const prevMonth = month > 1 ? month - 1 : 12;
    const prevYear = month > 1 ? year : year - 1;
    const { from: prevFrom, to: prevTo } = monthSqliteDateBounds(prevYear, prevMonth);
    const prevExpenseAgg = await prisma.ledgerTransaction.aggregate({
      where: await applySqliteDateRange(
        { type: "expense" },
        "ledger_transactions",
        prevFrom,
        prevTo,
      ),
      _sum: { amount: true },
    });
    const prevExpense = toDecimal(prevExpenseAgg._sum.amount);
    const changeRate = prevExpense.gt(0)
      ? expenseTotal.minus(prevExpense).div(prevExpense).times(100)
      : new Decimal(0);

    return jsonOk({
      period: { year, month },
      total_income: incomeTotal,
      total_expense: expenseTotal,
      net_cashflow: incomeTotal.minus(expenseTotal),
      by_category: byCategory,
      by_card: byCard,
      comparison: {
        prev_month_expense: prevExpense,
        expense_change_rate: changeRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
