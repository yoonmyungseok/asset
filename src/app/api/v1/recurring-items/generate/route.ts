import type { NextRequest } from "next/server";

import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { generateRecurringItems } from "@/lib/services/recurring-items";
import { recurringGenerateRequestSchema } from "@/lib/validations/ledger";

export async function POST(request: NextRequest) {
  try {
    const payload = parseJsonBody(recurringGenerateRequestSchema, await request.json());
    const result = await generateRecurringItems(payload.year, payload.month);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
