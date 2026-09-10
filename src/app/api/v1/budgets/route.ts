import type { NextRequest } from "next/server";

import { serializeBudgetResponse } from "@/lib/api/serializers";
import {
  handleRouteError,
  jsonOk,
  parseJsonBody,
  parseRequiredQueryInt,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { getBudgetAlerts, listBudgetResponses } from "@/lib/services/budgets";
import { calculateBudgetSpent } from "@/lib/services/core";
import { budgetUpsertSchema } from "@/lib/validations/ledger";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const year = parseRequiredQueryInt(params.get("year"), "year");
    const month = parseRequiredQueryInt(params.get("month"), "month");
    return jsonOk(await listBudgetResponses(year, month));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = parseJsonBody(budgetUpsertSchema, await request.json());

    const category = await prisma.category.findUnique({ where: { id: payload.category_id } });
    if (!category) {
      throw new ServiceError(404, "카테고리를 찾을 수 없습니다.");
    }

    const budget = await prisma.budget.upsert({
      where: {
        uq_budget_period: {
          category_id: payload.category_id,
          year: payload.year,
          month: payload.month,
        },
      },
      create: {
        category_id: payload.category_id,
        year: payload.year,
        month: payload.month,
        amount: payload.amount,
      },
      update: { amount: payload.amount },
      include: { category: true },
    });

    const spent = await calculateBudgetSpent(prisma, budget.category_id, budget.year, budget.month);
    return jsonOk(serializeBudgetResponse(budget, spent));
  } catch (error) {
    return handleRouteError(error);
  }
}
