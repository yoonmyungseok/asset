import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  buildAccountLimitResponse,
  serializeAccountLimit,
} from "@/lib/api/serializers";
import { apiError } from "@/lib/api-error";
import {
  handleRouteError,
  jsonOk,
  parseJsonBody,
  parseQueryInt,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { accountLimitUpsertSchema } from "@/lib/validations/account";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const accountId = parseQueryInt(params.get("account_id"));
    const targetYear = parseQueryInt(params.get("year")) ?? new Date().getFullYear();

    const limits = await prisma.accountYearlyLimit.findMany({
      where: {
        year: targetYear,
        account: { is_active: true },
        ...(accountId ? { account_id: accountId } : {}),
      },
      include: { account: true },
    });

    return jsonOk(limits.map((limit) => serializeAccountLimit(buildAccountLimitResponse(limit))));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = parseJsonBody(accountLimitUpsertSchema, await request.json());
    const account = await prisma.account.findUnique({ where: { id: payload.account_id } });
    if (!account) {
      return apiError(404, "계좌를 찾을 수 없습니다.");
    }

    const limit = await prisma.accountYearlyLimit.upsert({
      where: {
        uq_account_year: {
          account_id: payload.account_id,
          year: payload.year,
        },
      },
      create: {
        account_id: payload.account_id,
        year: payload.year,
        contribution_limit: payload.contribution_limit,
      },
      update: {
        contribution_limit: payload.contribution_limit,
      },
      include: { account: true },
    });

    return jsonOk(
      serializeAccountLimit(
        buildAccountLimitResponse({ ...limit, account: { name: account.name } }),
      ),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
