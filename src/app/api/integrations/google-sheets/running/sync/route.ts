import { syncRunningToGoogleSheets, isGoogleSheetsConfigured } from "@/lib/care/integrations/google-sheets/running-sync";
import { errorResponse, jsonResponse } from "@/lib/care/utils";

export async function POST() {
  try {
    if (!isGoogleSheetsConfigured()) {
      return errorResponse(
        "Google 서비스 계정이 설정되지 않았습니다. .env에 GOOGLE_SERVICE_ACCOUNT_JSON 등을 추가하세요.",
        503,
      );
    }

    const result = await syncRunningToGoogleSheets();
    return jsonResponse(result);
  } catch (error) {
    console.error("POST /api/integrations/google-sheets/running/sync:", error);
    const message =
      error instanceof Error ? error.message : "스프레드시트 동기화에 실패했습니다";
    const isConfig =
      message.includes("스프레드시트 ID") || message.includes("서비스 계정");
    return errorResponse(message, isConfig ? 400 : 500);
  }
}
