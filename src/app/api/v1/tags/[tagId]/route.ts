import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import { handleRouteError } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ tagId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { tagId: tagIdParam } = await params;
    const tagId = Number(tagIdParam);

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      return apiError(404, "태그를 찾을 수 없습니다.");
    }

    await prisma.ledgerTransactionTag.deleteMany({ where: { tag_id: tagId } });
    await prisma.tag.delete({ where: { id: tagId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
