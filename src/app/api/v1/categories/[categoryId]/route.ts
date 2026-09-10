import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { categoryUpdateSchema } from "@/lib/validations/ledger";

type RouteParams = { params: Promise<{ categoryId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { categoryId: categoryIdParam } = await params;
    const categoryId = Number(categoryIdParam);
    const payload = parseJsonBody(categoryUpdateSchema, await request.json());

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return apiError(404, "카테고리를 찾을 수 없습니다.");
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: payload,
    });
    return jsonOk(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { categoryId: categoryIdParam } = await params;
    const categoryId = Number(categoryIdParam);

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return apiError(404, "카테고리를 찾을 수 없습니다.");
    }

    const hasTx = await prisma.ledgerTransaction.findFirst({
      where: { category_id: categoryId },
    });
    if (hasTx) {
      return apiError(400, "연결된 거래가 있어 삭제할 수 없습니다. 비활성화를 사용하세요.");
    }

    await prisma.category.delete({ where: { id: categoryId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
