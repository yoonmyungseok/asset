import type { NextRequest } from "next/server";

import { handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  parseQueryDateBound,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";

type RouteContext = { params: Promise<{ accountId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { accountId: idRaw } = await context.params;
    const accountId = Number.parseInt(idRaw, 10);
    const fromDate = parseQueryDateBound(request.nextUrl.searchParams.get("from_date"), "start");
    const toDate = parseQueryDateBound(request.nextUrl.searchParams.get("to_date"), "end");

    const rows = await prisma.accountSnapshot.findMany({
      where: {
        ...(await applySqliteDateRange({}, "account_snapshots", fromDate, toDate)),
        account_id: accountId,
      },
      orderBy: { snapshot_date: "asc" },
    });

    return jsonOk(
      rows.map((row) => ({
        snapshot_date: row.snapshot_date,
        balance_value: toDecimal(row.balance_value),
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
