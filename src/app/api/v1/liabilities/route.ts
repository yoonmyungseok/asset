import type { NextRequest } from "next/server";

import { serializeLiability } from "@/lib/api/serializers";
import {
  handleRouteError,
  jsonOk,
  parseJsonBody,
  parseQueryBool,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { liabilityCreateSchema } from "@/lib/validations/liability";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get("type") ?? undefined;
    const isActiveParam = parseQueryBool(params.get("is_active"));
    const isActive = isActiveParam === undefined ? true : isActiveParam;

    const liabilities = await prisma.liability.findMany({
      where: {
        ...(isActive == null ? {} : { is_active: isActive }),
        ...(type ? { type } : {}),
      },
      orderBy: { id: "asc" },
    });

    return jsonOk(liabilities.map(serializeLiability));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(liabilityCreateSchema, await request.json());
    const liability = await prisma.liability.create({ data: payload });
    return jsonOk(serializeLiability(liability), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
