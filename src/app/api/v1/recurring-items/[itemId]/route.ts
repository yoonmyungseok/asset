import type { NextRequest } from "next/server";

import { RECURRING_ITEM_INCLUDE, serializeRecurringItem } from "@/lib/api/serializers";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { recurringItemUpdateSchema } from "@/lib/validations/ledger";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { itemId: idRaw } = await context.params;
    const itemId = Number.parseInt(idRaw, 10);
    const payload = parseJsonBody(recurringItemUpdateSchema, await request.json());

    const existing = await prisma.recurringItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      throw new ServiceError(404, "정기 항목을 찾을 수 없습니다.");
    }

    const item = await prisma.recurringItem.update({
      where: { id: itemId },
      data: payload,
      include: RECURRING_ITEM_INCLUDE,
    });

    return jsonOk(serializeRecurringItem(item));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { itemId: idRaw } = await context.params;
    const itemId = Number.parseInt(idRaw, 10);

    const existing = await prisma.recurringItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      throw new ServiceError(404, "정기 항목을 찾을 수 없습니다.");
    }

    await prisma.recurringItem.delete({ where: { id: itemId } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
