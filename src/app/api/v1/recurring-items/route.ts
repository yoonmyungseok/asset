import type { NextRequest } from "next/server";

import { RECURRING_ITEM_INCLUDE, serializeRecurringItem } from "@/lib/api/serializers";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { recurringItemCreateSchema } from "@/lib/validations/ledger";

export async function GET() {
  try {
    const items = await prisma.recurringItem.findMany({
      include: RECURRING_ITEM_INCLUDE,
      orderBy: { id: "asc" },
    });
    return jsonOk(items.map(serializeRecurringItem));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(recurringItemCreateSchema, await request.json());
    const item = await prisma.recurringItem.create({
      data: payload,
      include: RECURRING_ITEM_INCLUDE,
    });
    return jsonOk(serializeRecurringItem(item), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
