import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-error";
import { RateLimitError, searchMarket } from "@/lib/external/market-data";
import { TossApiError } from "@/lib/external/toss-invest";
import { handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { ServiceError } from "@/lib/service-error";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q");
    if (!q || q.length < 1) {
      throw new ServiceError(422, "q is required");
    }

    return jsonOk(await searchMarket(q));
  } catch (error) {
    if (error instanceof RateLimitError) {
      return apiError(429, error.message);
    }
    if (error instanceof TossApiError) {
      return apiError(400, error.message);
    }
    return handleRouteError(error);
  }
}
