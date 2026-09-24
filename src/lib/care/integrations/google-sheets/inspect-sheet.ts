import { getGoogleSheetsClient, quoteSheetName } from "@/lib/care/integrations/google-sheets/client";
import {
  buildColumnIndex,
  parseHeaderAliasesJson,
  type HeaderAliases,
} from "@/lib/care/integrations/google-sheets/header-map";
import {
  RUNNING_SHEET_HEADERS,
  RUNNING_SPLIT_SHEET_HEADERS,
} from "@/lib/care/integrations/google-sheets/running-rows";
import { getSettings } from "@/lib/care/services/settings";

export interface SheetInspectResult {
  spreadsheetId: string;
  running: {
    sheetName: string;
    headerRow: string[];
    matchedFields: string[];
    missingFields: string[];
  };
  splits: {
    sheetName: string;
    headerRow: string[];
    matchedFields: string[];
    missingFields: string[];
  };
}

async function readHeaderRow(spreadsheetId: string, sheetTitle: string): Promise<string[]> {
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetTitle);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoted}!1:1`,
  });
  const row = res.data.values?.[0];
  if (!row?.length) return [];
  return row.map((cell) => String(cell ?? "").trim());
}

function inspectMapping(
  headerRow: string[],
  fields: readonly string[],
  aliases?: HeaderAliases,
) {
  const index = buildColumnIndex(headerRow, fields, aliases);
  const matchedFields = fields.filter((f) => index.has(f));
  const missingFields = fields.filter((f) => !index.has(f));
  return { matchedFields, missingFields };
}

export async function inspectGoogleSpreadsheet(): Promise<SheetInspectResult> {
  const settings = await getSettings();
  const spreadsheetId = settings.googleSpreadsheetId;
  if (!spreadsheetId) {
    throw new Error("스프레드시트 ID가 설정되지 않았습니다.");
  }

  const runningAliases = parseHeaderAliasesJson(settings.googleRunningHeaderMap);
  const splitAliases = parseHeaderAliasesJson(settings.googleRunningSplitHeaderMap);

  const [runningHeader, splitHeader] = await Promise.all([
    readHeaderRow(spreadsheetId, settings.googleRunningSheetName),
    readHeaderRow(spreadsheetId, settings.googleRunningSplitSheetName),
  ]);

  const running = inspectMapping(runningHeader, RUNNING_SHEET_HEADERS, runningAliases);
  const splits = inspectMapping(splitHeader, RUNNING_SPLIT_SHEET_HEADERS, splitAliases);

  return {
    spreadsheetId,
    running: {
      sheetName: settings.googleRunningSheetName,
      headerRow: runningHeader,
      matchedFields: [...running.matchedFields],
      missingFields: [...running.missingFields],
    },
    splits: {
      sheetName: settings.googleRunningSplitSheetName,
      headerRow: splitHeader,
      matchedFields: [...splits.matchedFields],
      missingFields: [...splits.missingFields],
    },
  };
}
