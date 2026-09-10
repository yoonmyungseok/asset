import type { NextRequest } from "next/server";

import { handleRouteError, jsonOk, parseRequiredQueryInt } from "@/lib/api/route-utils";
import { getBudgetAlerts } from "@/lib/services/budgets";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const year = parseRequiredQueryInt(params.get("year"), "year");
    const month = parseRequiredQueryInt(params.get("month"), "month");
    return jsonOk(await getBudgetAlerts(year, month));
  } catch (error) {
    return handleRouteError(error);
  }
}
