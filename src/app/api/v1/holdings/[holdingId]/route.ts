import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { serializeHoldingModel } from "@/lib/api/serializers";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { deleteHolding, updateHolding } from "@/lib/services/holdings";
import { holdingUpdateSchema } from "@/lib/validations/account";

type RouteParams = { params: Promise<{ holdingId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { holdingId: holdingIdParam } = await params;
    const holdingId = Number(holdingIdParam);
    const payload = parseJsonBody(holdingUpdateSchema, await request.json());

    const updated = await updateHolding(holdingId, payload);
    return jsonOk(serializeHoldingModel(updated, updated.account.name));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { holdingId: holdingIdParam } = await params;
    await deleteHolding(Number(holdingIdParam));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
