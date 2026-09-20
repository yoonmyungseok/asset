import type { NextRequest } from "next/server";

import { handleRouteError, jsonOk, formatDateOnly } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  parseQueryDateBound,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";
import { saveDailySnapshot } from "@/lib/services/core";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const toDateParam = params.get("to_date");
    const toDate = toDateParam ? new Date(toDateParam) : new Date();
    const fromDateParam = params.get("from_date");
    const rangeAll = params.get("range") === "all";
    let fromBound;
    if (fromDateParam) {
      fromBound = parseQueryDateBound(fromDateParam, "start");
    } else if (rangeAll) {
      const earliest = await prisma.dailySnapshot.findFirst({
        orderBy: { snapshot_date: "asc" },
        select: { snapshot_date: true },
      });
      fromBound = earliest
        ? parseQueryDateBound(
            formatDateOnly(
              earliest.snapshot_date instanceof Date
                ? earliest.snapshot_date
                : new Date(earliest.snapshot_date),
            ),
            "start",
          )
        : parseQueryDateBound(formatDateOnly(toDate), "start");
    } else {
      fromBound = parseQueryDateBound(
        formatDateOnly(new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000)),
        "start",
      );
    }
    const toBound = parseQueryDateBound(toDateParam ?? formatDateOnly(toDate), "end");

    await saveDailySnapshot(prisma, toDate);

    const rows = await prisma.dailySnapshot.findMany({
      where: await applySqliteDateRange({}, "daily_snapshots", fromBound, toBound),
      orderBy: { snapshot_date: "asc" },
    });

    return jsonOk({
      data: rows.map((row) => ({
        date: row.snapshot_date,
        total_assets: toDecimal(row.total_assets),
        total_liabilities: toDecimal(row.total_liabilities),
        net_worth: toDecimal(row.net_worth),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
