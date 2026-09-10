import type { NextRequest } from "next/server";

import {
  handleRouteError,
  jsonOk,
  parseQueryInt,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  monthSqliteDateBounds,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";

export async function GET(request: NextRequest) {
  try {
    const months = Math.min(Math.max(parseQueryInt(request.nextUrl.searchParams.get("months"), 6)!, 1), 24);
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth() + 1;
    const data = [];

    for (let i = 0; i < months; i += 1) {
      const { from, to } = monthSqliteDateBounds(year, month);
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
      data.push({
        year,
        month,
        income,
        expense,
        net: income.minus(expense),
      });

      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }

    data.reverse();
    return jsonOk({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
