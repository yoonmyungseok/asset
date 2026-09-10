import type { NextRequest } from "next/server";

import { clearTossCredentials, saveTossCredentials } from "@/lib/config";
import { clearTokenCache } from "@/lib/external/toss-invest";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { ServiceError } from "@/lib/service-error";
import { tossCredentialsUpdateSchema } from "@/lib/validations/system";
import { marketStatus } from "@/app/api/v1/market/status/route";

export async function PUT(request: NextRequest) {
  try {
    const payload = parseJsonBody(tossCredentialsUpdateSchema, await request.json());
    if (!payload.client_id.trim() || !payload.client_secret.trim()) {
      throw new ServiceError(400, "Client ID와 Secret을 입력하세요.");
    }
    await saveTossCredentials(payload.client_id.trim(), payload.client_secret.trim());
    await clearTokenCache();
    return jsonOk(await marketStatus());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    await clearTossCredentials();
    await clearTokenCache();
    return jsonOk(await marketStatus());
  } catch (error) {
    return handleRouteError(error);
  }
}
