import { inspectGoogleSpreadsheet } from "@/lib/care/integrations/google-sheets/inspect-sheet";
import { isGoogleSheetsConfigured } from "@/lib/care/integrations/google-sheets/running-sync";
import { errorResponse, jsonResponse } from "@/lib/care/utils";

export async function GET() {
  try {
    if (!isGoogleSheetsConfigured()) {
      return errorResponse("Google 서비스 계정이 설정되지 않았습니다.", 503);
    }

    const result = await inspectGoogleSpreadsheet();
    return jsonResponse(result);
  } catch (error) {
    console.error("GET /api/integrations/google-sheets/inspect:", error);
    const message =
      error instanceof Error ? error.message : "시트 구조를 읽지 못했습니다";
    return errorResponse(message, 500);
  }
}
