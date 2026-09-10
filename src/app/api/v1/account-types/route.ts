import type { NextRequest } from "next/server";

import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { accountTypeCreateSchema } from "@/lib/validations/account";

export async function GET() {
  try {
    const rows = await prisma.accountType.findMany({
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    });
    return jsonOk(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(accountTypeCreateSchema, await request.json());
    const exists = await prisma.accountType.findUnique({ where: { code: payload.code } });
    if (exists) {
      return apiError(400, "이미 존재하는 계좌 유형 코드입니다.");
    }

    const created = await prisma.accountType.create({
      data: { ...payload, is_system: false },
    });
    return jsonOk(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
