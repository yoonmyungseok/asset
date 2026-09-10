import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-error";
import { getQuote, RateLimitError } from "@/lib/external/market-data";
import { TossApiError } from "@/lib/external/toss-invest";
import { handleRouteError, jsonOk } from "@/lib/api/route-utils";

type RouteContext = { params: Promise<{ symbol: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { symbol } = await context.params;
    return jsonOk(await getQuote(decodeURIComponent(symbol)));
  } catch (error) {
    if (error instanceof RateLimitError) {
      return apiError(429, error.message);
    }
    if (error instanceof Error && error.message === "시세 조회 실패") {
      return apiError(400, error.message);
    }
    if (error instanceof TossApiError) {
      return apiError(400, error.message);
    }
    return handleRouteError(error);
  }
}
