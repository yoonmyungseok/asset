import type { NextRequest } from "next/server";

import { handleRouteError } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { budgetId: idRaw } = await context.params;
    const budgetId = Number.parseInt(idRaw, 10);

    const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
    if (!budget) {
      throw new ServiceError(404, "예산을 찾을 수 없습니다.");
    }

    await prisma.budget.delete({ where: { id: budgetId } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
