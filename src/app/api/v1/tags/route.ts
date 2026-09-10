import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-error";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { tagCreateSchema } from "@/lib/validations/ledger";

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
    const results = await Promise.all(
      tags.map(async (tag) => ({
        id: tag.id,
        name: tag.name,
        usage_count: await prisma.ledgerTransactionTag.count({ where: { tag_id: tag.id } }),
      })),
    );
    return jsonOk(results);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = parseJsonBody(tagCreateSchema, await request.json());
    const exists = await prisma.tag.findUnique({ where: { name } });
    if (exists) {
      return apiError(400, "이미 존재하는 태그입니다.");
    }

    const tag = await prisma.tag.create({ data: { name } });
    return jsonOk({ id: tag.id, name: tag.name, usage_count: 0 }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
