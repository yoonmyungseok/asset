import {
  isGoogleSheetsConfigured,
  resolveSpreadsheetId,
} from "@/lib/care/integrations/google-sheets/running-sync";
import { getGoogleSheetsSettings } from "@/lib/care/services/google-sheets-settings";
import { errorResponse, jsonResponse } from "@/lib/care/utils";

export async function GET() {
  try {
    const sheets = await getGoogleSheetsSettings();
    const spreadsheetId = resolveSpreadsheetId(sheets.googleSpreadsheetId);
    return jsonResponse({
      serviceAccountConfigured: isGoogleSheetsConfigured(),
      spreadsheetConfigured: Boolean(spreadsheetId),
      spreadsheetFromEnv: Boolean(
        !sheets.googleSpreadsheetId?.trim() && process.env.GOOGLE_SPREADSHEET_ID?.trim(),
      ),
      googleSpreadsheetId: spreadsheetId,
      googleRunningSheetName: sheets.googleRunningSheetName,
      googleRunningSplitSheetName: sheets.googleRunningSplitSheetName,
      googleSheetsLastSyncedAt: sheets.googleSheetsLastSyncedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("GET /api/integrations/google-sheets/status:", error);
    return errorResponse("연동 상태를 불러오지 못했습니다", 500);
  }
}
