import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import { handleRouteError } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ limitId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { limitId: limitIdParam } = await params;
    const limitId = Number(limitIdParam);

    const limit = await prisma.accountYearlyLimit.findUnique({ where: { id: limitId } });
    if (!limit) {
      return apiError(404, "한도 정보를 찾을 수 없습니다.");
    }

    await prisma.accountYearlyLimit.delete({ where: { id: limitId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
