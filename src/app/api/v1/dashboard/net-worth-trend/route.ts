import type { NextRequest } from "next/server";

import { handleRouteError, jsonOk, parseQueryInt } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  monthSqliteDateBounds,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";
import { saveDailySnapshot } from "@/lib/services/core";

export async function GET(request: NextRequest) {
  try {
    const months = Math.min(Math.max(parseQueryInt(request.nextUrl.searchParams.get("months"), 12)!, 1), 24);
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth() + 1;

    const monthList: { year: number; month: number }[] = [];
    for (let i = 0; i < months; i += 1) {
      monthList.unshift({ year, month });
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }

    const firstMonth = monthList[0];
    const lastMonth = monthList[monthList.length - 1];
    const { from: fromBound } = monthSqliteDateBounds(firstMonth.year, firstMonth.month);
    const { to: toBound } = monthSqliteDateBounds(lastMonth.year, lastMonth.month);

    await saveDailySnapshot(prisma, today);

    const rows = await prisma.dailySnapshot.findMany({
      where: await applySqliteDateRange({}, "daily_snapshots", fromBound, toBound),
      orderBy: { snapshot_date: "asc" },
    });

    const latestByMonth = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const snapshotDate = row.snapshot_date;
      const key = `${snapshotDate.getUTCFullYear()}-${snapshotDate.getUTCMonth() + 1}`;
      latestByMonth.set(key, row);
    }

    const data = monthList
      .map(({ year: y, month: m }) => {
        const row = latestByMonth.get(`${y}-${m}`);
        if (!row) return null;
        return {
          year: y,
          month: m,
          total_assets: toDecimal(row.total_assets),
          total_liabilities: toDecimal(row.total_liabilities),
          net_worth: toDecimal(row.net_worth),
        };
      })
      .filter((point): point is NonNullable<typeof point> => point != null);

    return jsonOk({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
