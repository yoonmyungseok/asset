import {
  isTossConfiguredAsync,
  TossApiError,
  TossRateLimitError,
  verifyConnection,
} from "@/lib/external/toss-invest";
import { handleRouteError, jsonOk } from "@/lib/api/route-utils";

async function marketStatus() {
  const configured = await isTossConfiguredAsync();
  if (!configured) {
    return {
      provider: "fallback",
      configured: false,
      connected: false,
      message: "토스증권 API 미설정. 네이버/야후 폴백을 사용 중입니다.",
    };
  }

  try {
    await verifyConnection();
    return {
      provider: "toss",
      configured: true,
      connected: true,
      message: "토스증권 API 연결됨",
    };
  } catch (error) {
    if (error instanceof TossRateLimitError || error instanceof TossApiError) {
      return {
        provider: "toss",
        configured: true,
        connected: false,
        message: error.message,
      };
    }
    throw error;
  }
}

export async function GET() {
  try {
    return jsonOk(await marketStatus());
  } catch (error) {
    return handleRouteError(error);
  }
}

export { marketStatus };
