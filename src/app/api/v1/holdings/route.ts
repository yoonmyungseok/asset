import type { NextRequest } from "next/server";

import { serializeHoldingModel } from "@/lib/api/serializers";
import {
  handleRouteError,
  jsonOk,
  parseJsonBody,
  parseQueryInt,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { createHolding } from "@/lib/services/holdings";
import { holdingCreateSchema } from "@/lib/validations/account";

export async function GET(request: NextRequest) {
  try {
    const accountId = parseQueryInt(request.nextUrl.searchParams.get("account_id"));
    const holdings = await prisma.holding.findMany({
      where: {
        quantity: { gt: 0 },
        ...(accountId ? { account_id: accountId } : {}),
      },
      include: { account: true },
      orderBy: { id: "asc" },
    });

    return jsonOk(
      holdings.map((holding) =>
        serializeHoldingModel(holding, holding.account.name),
      ),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(holdingCreateSchema, await request.json());
    const holding = await createHolding(payload);
    return jsonOk(
      serializeHoldingModel(holding, holding.account.name),
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
