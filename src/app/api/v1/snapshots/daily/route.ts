import type { NextRequest } from "next/server";

import { handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  parseQueryDateBound,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";
import { saveDailySnapshot } from "@/lib/services/core";

export async function POST() {
  try {
    const snapshot = await saveDailySnapshot(prisma);
    return jsonOk(
      {
        id: snapshot.id,
        snapshot_date: snapshot.snapshot_date,
        total_assets: toDecimal(snapshot.total_assets),
        total_liabilities: toDecimal(snapshot.total_liabilities),
        net_worth: toDecimal(snapshot.net_worth),
        investment_total: toDecimal(snapshot.investment_total),
        cash_total: toDecimal(snapshot.cash_total),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const fromDate = parseQueryDateBound(request.nextUrl.searchParams.get("from_date"), "start");
    const toDate = parseQueryDateBound(request.nextUrl.searchParams.get("to_date"), "end");

    const snapshots = await prisma.dailySnapshot.findMany({
      where: await applySqliteDateRange({}, "daily_snapshots", fromDate, toDate),
      orderBy: { snapshot_date: "asc" },
    });

    return jsonOk(
      snapshots.map((row) => ({
        id: row.id,
        snapshot_date: row.snapshot_date,
        total_assets: toDecimal(row.total_assets),
        total_liabilities: toDecimal(row.total_liabilities),
        net_worth: toDecimal(row.net_worth),
        investment_total: toDecimal(row.investment_total),
        cash_total: toDecimal(row.cash_total),
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
