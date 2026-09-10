import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-error";
import {
  handleRouteError,
  jsonOk,
  parseJsonBody,
  parseQueryBool,
  parseQueryInt,
} from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import { categoryCreateSchema } from "@/lib/validations/ledger";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get("type") ?? undefined;
    const parentId = parseQueryInt(params.get("parent_id"));
    const includeChildren = params.get("include_children") === "true";
    const isActive = params.has("is_active")
      ? (parseQueryBool(params.get("is_active")) ?? true)
      : true;

    if (includeChildren) {
      const parents = await prisma.category.findMany({
        where: {
          parent_id: null,
          is_active: isActive,
          ...(type ? { type } : {}),
        },
        orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      });

      const result = await Promise.all(
        parents.map(async (parent) => {
          const children = await prisma.category.findMany({
            where: { parent_id: parent.id },
            orderBy: [{ sort_order: "asc" }, { id: "asc" }],
          });
          return { ...parent, children };
        }),
      );
      return jsonOk(result);
    }

    const rows = await prisma.category.findMany({
      where: {
        is_active: isActive,
        ...(type ? { type } : {}),
        ...(parentId != null ? { parent_id: parentId } : {}),
      },
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    });
    return jsonOk(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(categoryCreateSchema, await request.json());

    if (payload.parent_id) {
      const parent = await prisma.category.findUnique({ where: { id: payload.parent_id } });
      if (!parent) {
        return apiError(404, "상위 카테고리를 찾을 수 없습니다.");
      }
      if (parent.parent_id != null) {
        return apiError(400, "2단계 카테고리만 지원합니다.");
      }
    }

    const created = await prisma.category.create({
      data: {
        name: payload.name,
        type: payload.type,
        parent_id: payload.parent_id ?? null,
        sort_order: payload.sort_order,
        is_system: false,
        is_active: true,
      },
    });
    return jsonOk(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
