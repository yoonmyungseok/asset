import type { NextRequest } from "next/server";

import { serializeAccountResponse } from "@/lib/api/serializers";
import { apiError } from "@/lib/api-error";
import { handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { accountToResponse } from "@/lib/services/core";

type RouteParams = { params: Promise<{ accountId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { accountId: accountIdParam } = await params;
    const accountId = Number(accountIdParam);

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { account_type: true },
    });
    if (!account) {
      return apiError(404, "계좌를 찾을 수 없습니다.");
    }

    await prisma.$transaction([
      prisma.account.update({ where: { id: accountId }, data: { is_active: false } }),
      prisma.accountYearlyLimit.deleteMany({ where: { account_id: accountId } }),
    ]);

    const updated = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      include: { account_type: true },
    });
    const response = await accountToResponse(prisma, updated);
    return jsonOk(serializeAccountResponse(response));
  } catch (error) {
    return handleRouteError(error);
  }
}
