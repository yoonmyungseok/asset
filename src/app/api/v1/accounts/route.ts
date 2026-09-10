import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { serializeAccountResponse } from "@/lib/api/serializers";
import { apiError } from "@/lib/api-error";
import {
  handleRouteError,
  jsonOk,
  parseJsonBody,
  parseQueryBool,
  parseQueryInt,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { accountToResponse, serializeAccountMetadata } from "@/lib/services/core";
import { accountCreateSchema } from "@/lib/validations/account";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const category = params.get("category") ?? undefined;
    const accountTypeId = parseQueryInt(params.get("account_type_id"));
    const isActive = params.has("is_active")
      ? (parseQueryBool(params.get("is_active")) ?? true)
      : true;
    const includeSummary = params.get("include_summary") === "true";

    const accounts = await prisma.account.findMany({
      where: {
        is_active: isActive,
        ...(accountTypeId ? { account_type_id: accountTypeId } : {}),
        ...(category ? { account_type: { category } } : {}),
      },
      include: { account_type: true },
      orderBy: { id: "asc" },
    });

    const responses = await Promise.all(
      accounts.map((account) => accountToResponse(prisma, account, includeSummary)),
    );
    return jsonOk(responses.map(serializeAccountResponse));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(accountCreateSchema, await request.json());
    const accountType = await prisma.accountType.findUnique({
      where: { id: payload.account_type_id },
    });
    if (!accountType) {
      return apiError(404, "계좌 유형을 찾을 수 없습니다.");
    }

    const created = await prisma.account.create({
      data: {
        account_type_id: payload.account_type_id,
        name: payload.name,
        institution: payload.institution ?? null,
        cash_balance: payload.cash_balance,
        metadata_json: (serializeAccountMetadata(payload.metadata ?? null) ??
          undefined) as Prisma.InputJsonValue | undefined,
      },
      include: { account_type: true },
    });

    const response = await accountToResponse(prisma, created);
    return jsonOk(serializeAccountResponse(response), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
