import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { serializeAccountResponse } from "@/lib/api/serializers";
import { apiError } from "@/lib/api-error";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { accountToResponse, serializeAccountMetadata } from "@/lib/services/core";
import { accountUpdateSchema } from "@/lib/validations/account";

type RouteParams = { params: Promise<{ accountId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    const response = await accountToResponse(prisma, account, true);
    return jsonOk(serializeAccountResponse(response));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { accountId: accountIdParam } = await params;
    const accountId = Number(accountIdParam);
    const payload = parseJsonBody(accountUpdateSchema, await request.json());

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { account_type: true },
    });
    if (!account) {
      return apiError(404, "계좌를 찾을 수 없습니다.");
    }

    if (payload.account_type_id != null) {
      const accountType = await prisma.accountType.findUnique({
        where: { id: payload.account_type_id },
      });
      if (!accountType) {
        return apiError(404, "계좌 유형을 찾을 수 없습니다.");
      }
    }

    const { metadata, account_type_id, ...rest } = payload;
    const updateData: Prisma.AccountUncheckedUpdateInput = { ...rest };
    if (account_type_id !== undefined) {
      updateData.account_type_id = account_type_id;
    }
    if (metadata !== undefined) {
      updateData.metadata_json = serializeAccountMetadata(metadata) as Prisma.InputJsonValue;
    }

    const updated = await prisma.account.update({
      where: { id: accountId },
      data: updateData,
      include: { account_type: true },
    });

    const response = await accountToResponse(prisma, updated);
    return jsonOk(serializeAccountResponse(response));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { accountId: accountIdParam } = await params;
    const accountId = Number(accountIdParam);

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      return apiError(404, "계좌를 찾을 수 없습니다.");
    }

    const hasHolding = await prisma.holding.findFirst({ where: { account_id: accountId } });
    const hasTx = await prisma.investmentTransaction.findFirst({
      where: { account_id: accountId },
    });
    if (hasHolding || hasTx) {
      return apiError(400, "연관 데이터가 있어 삭제할 수 없습니다. 비활성화를 사용하세요.");
    }

    await prisma.account.delete({ where: { id: accountId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
