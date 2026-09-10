import type { NextRequest } from "next/server";

import { serializeLiability } from "@/lib/api/serializers";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { liabilityUpdateSchema } from "@/lib/validations/liability";

type RouteContext = { params: Promise<{ liabilityId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { liabilityId: idRaw } = await context.params;
    const liabilityId = Number.parseInt(idRaw, 10);
    const payload = parseJsonBody(liabilityUpdateSchema, await request.json());

    const existing = await prisma.liability.findUnique({ where: { id: liabilityId } });
    if (!existing) {
      throw new ServiceError(404, "부채를 찾을 수 없습니다.");
    }

    const liability = await prisma.liability.update({
      where: { id: liabilityId },
      data: payload,
    });

    return jsonOk(serializeLiability(liability));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { liabilityId: idRaw } = await context.params;
    const liabilityId = Number.parseInt(idRaw, 10);

    const existing = await prisma.liability.findUnique({ where: { id: liabilityId } });
    if (!existing) {
      throw new ServiceError(404, "부채를 찾을 수 없습니다.");
    }

    await prisma.liability.delete({ where: { id: liabilityId } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
