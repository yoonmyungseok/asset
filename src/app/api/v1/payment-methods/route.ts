import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-error";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { paymentMethodCreateSchema } from "@/lib/validations/ledger";

export async function GET() {
  try {
    const rows = await prisma.paymentMethod.findMany({ orderBy: { id: "asc" } });
    return jsonOk(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = parseJsonBody(paymentMethodCreateSchema, await request.json());
    const exists = await prisma.paymentMethod.findUnique({ where: { name } });
    if (exists) {
      return apiError(400, "이미 존재하는 결제 수단입니다.");
    }

    const created = await prisma.paymentMethod.create({
      data: { name, is_system: false },
    });
    return jsonOk(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
