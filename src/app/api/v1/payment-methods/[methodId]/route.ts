import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import { handleRouteError } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ methodId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { methodId: methodIdParam } = await params;
    const methodId = Number(methodIdParam);

    const method = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
    if (!method) {
      return apiError(404, "결제 수단을 찾을 수 없습니다.");
    }
    if (method.is_system) {
      return apiError(400, "시스템 기본 결제 수단은 삭제할 수 없습니다.");
    }

    const inUse = await prisma.ledgerTransaction.findFirst({
      where: { payment_method_id: methodId },
    });
    if (inUse) {
      return apiError(400, "사용 중인 결제 수단은 삭제할 수 없습니다.");
    }

    await prisma.paymentMethod.delete({ where: { id: methodId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
