import type { NextRequest } from "next/server";

import { formatDateOnly, handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  parseQueryDateBound,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";
import { saveDailySnapshot } from "@/lib/services/core";
import { normalizeChartDate } from "@/lib/utils/format";

type RouteContext = { params: Promise<{ accountId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { accountId: idRaw } = await context.params;
    const accountId = Number.parseInt(idRaw, 10);
    const fromDate = parseQueryDateBound(request.nextUrl.searchParams.get("from_date"), "start");
    const toDate = parseQueryDateBound(request.nextUrl.searchParams.get("to_date"), "end");

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { account_type: true },
    });
    if (!account) {
      return jsonOk([]);
    }

    await saveDailySnapshot(prisma);

    const rows = await prisma.accountSnapshot.findMany({
      where: {
        ...(await applySqliteDateRange({}, "account_snapshots", fromDate, toDate)),
        account_id: accountId,
      },
      orderBy: { snapshot_date: "asc" },
    });

    const byDate = new Map<string, {
      snapshot_date: string;
      balance_value: ReturnType<typeof toDecimal>;
      isNormalized: boolean;
    }>();
    for (const row of rows) {
      const normalizedDate = normalizeChartDate(row.snapshot_date);
      const dateKey = formatDateOnly(normalizedDate);
      const isNormalized = row.snapshot_date.getTime() === normalizedDate.getTime();
      const balanceValue = toDecimal(row.balance_value);
      const existing = byDate.get(dateKey);
      if (
        !existing
        || (isNormalized && !existing.isNormalized)
        || (isNormalized === existing.isNormalized && balanceValue.gt(existing.balance_value))
      ) {
        byDate.set(dateKey, {
          snapshot_date: dateKey,
          balance_value: balanceValue,
          isNormalized,
        });
      }
    }

    return jsonOk(
      [...byDate.values()]
        .map(({ snapshot_date, balance_value }) => ({ snapshot_date, balance_value }))
        .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
