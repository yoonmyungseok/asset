import { parseHeaderAliasesJson } from "@/lib/care/integrations/google-sheets/header-map";
import { parseSpreadsheetId } from "@/lib/care/integrations/google-sheets/parse-spreadsheet-id";
import {
  getGoogleSheetsSettings,
  updateGoogleSheetsSettings,
} from "@/lib/care/services/google-sheets-settings";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { googleSheetsSettingsSchema } from "@/lib/care/validations/schemas";

export async function GET() {
  try {
    const settings = await getGoogleSheetsSettings();
    return jsonResponse({
      googleSpreadsheetId: settings.googleSpreadsheetId,
      googleRunningSheetName: settings.googleRunningSheetName,
      googleRunningSplitSheetName: settings.googleRunningSplitSheetName,
      googleRunningHeaderMap: settings.googleRunningHeaderMap,
      googleRunningSplitHeaderMap: settings.googleRunningSplitHeaderMap,
      googleRunningUpsertKey: settings.googleRunningUpsertKey,
      googleRunningSplitUpsertKey: settings.googleRunningSplitUpsertKey,
      googleSheetsLastSyncedAt: settings.googleSheetsLastSyncedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("GET /api/integrations/google-sheets/settings:", error);
    return errorResponse("설정을 불러오지 못했습니다", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = googleSheetsSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const existing = await getGoogleSheetsSettings();
    const input = parsed.data.spreadsheetInput?.trim() ?? "";
    const spreadsheetId = input
      ? parseSpreadsheetId(input)
      : existing.googleSpreadsheetId;
    if (!spreadsheetId) {
      return errorResponse(
        "스프레드시트 URL 또는 ID를 입력해주세요. (형식만 적용한 경우 URL 저장이 필요합니다)",
      );
    }
    if (input && !parseSpreadsheetId(input)) {
      return errorResponse("올바른 스프레드시트 URL 또는 ID를 입력해주세요");
    }

    for (const [label, raw] of [
      ["러닝 헤더 매핑", parsed.data.googleRunningHeaderMap],
      ["스플릿 헤더 매핑", parsed.data.googleRunningSplitHeaderMap],
    ] as const) {
      if (raw?.trim() && parseHeaderAliasesJson(raw) === undefined) {
        return errorResponse(`${label} JSON 형식이 올바르지 않습니다`);
      }
    }

    await updateGoogleSheetsSettings(parsed.data, spreadsheetId);
    const settings = await getGoogleSheetsSettings();
    return jsonResponse({
      googleSpreadsheetId: settings.googleSpreadsheetId,
      googleRunningSheetName: settings.googleRunningSheetName,
      googleRunningSplitSheetName: settings.googleRunningSplitSheetName,
      googleRunningHeaderMap: settings.googleRunningHeaderMap,
      googleRunningSplitHeaderMap: settings.googleRunningSplitHeaderMap,
      googleRunningUpsertKey: settings.googleRunningUpsertKey,
      googleRunningSplitUpsertKey: settings.googleRunningSplitUpsertKey,
      googleSheetsLastSyncedAt: settings.googleSheetsLastSyncedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("PUT /api/integrations/google-sheets/settings:", error);
    return errorResponse("설정을 저장하지 못했습니다", 500);
  }
}
