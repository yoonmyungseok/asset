import type { NextRequest } from "next/server";

import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { refreshPrices } from "@/lib/services/holdings";
import { refreshPricesRequestSchema } from "@/lib/validations/account";

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(
      refreshPricesRequestSchema,
      await request.json().catch(() => ({})),
    );
    const result = await refreshPrices(payload.holding_ids);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
