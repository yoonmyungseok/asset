import { getGoogleSheetsClient, quoteSheetName } from "@/lib/care/integrations/google-sheets/client";
import { normalizeDateKey } from "@/lib/care/integrations/google-sheets/sheet-date";
import { columnLetter, getSheetId } from "@/lib/care/integrations/google-sheets/sheet-upsert";

type SheetCell = string | number | boolean | null | undefined;

const DAILY_LOG_DOT_DATE = /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}/;

/** Daily_Log 기존 행에서 날짜 표기(예: 2026. 6. 6) 샘플 */
export function inferDailyLogDateSample(
  dataRows: SheetCell[][] | null | undefined,
  dateColumnIndex: number,
  todayKey: string,
): string | undefined {
  const rows = dataRows ?? [];
  for (let i = 0; i < rows.length; i++) {
    const sheetRow = i + 2;
    if (sheetRow === 2) continue;
    const raw = rows[i]?.[dateColumnIndex];
    if (raw == null || raw === "") continue;
    const text = String(raw).trim();
    if (DAILY_LOG_DOT_DATE.test(text)) return text;
    const key = normalizeDateKey(raw);
    if (key && key !== todayKey) return text;
  }
  return undefined;
}

/** ISO yyyy-MM-dd → 시트에 맞춘 날짜 문자열 */
export function formatDateForDailyLogSheet(isoDateKey: string, sample?: string): string {
  const key = normalizeDateKey(isoDateKey);
  if (!key) return isoDateKey;
  if (sample && DAILY_LOG_DOT_DATE.test(sample.trim())) {
    const [y, m, d] = key.split("-").map((p) => Number(p));
    return `${y}. ${m}. ${d}`;
  }
  return key;
}

/**
 * Daily_Log: 2행=오늘, 3행~ 날짜 내림차순. 새 날짜 행 삽입 위치(1-based).
 */
export function findDailyLogInsertRow1Based(
  dataRows: SheetCell[][],
  dateColumnIndex: number,
  newDateKey: string,
): number {
  for (let i = 0; i < dataRows.length; i++) {
    const sheetRow = i + 2;
    if (sheetRow === 2) continue;
    const row = dataRows[i];
    if (!row?.length) continue;
    const existing = normalizeDateKey(row[dateColumnIndex]);
    if (!existing) continue;
    if (newDateKey > existing) {
      return sheetRow;
    }
  }
  return dataRows.length + 2;
}

async function insertBlankRowsAt(
  spreadsheetId: string,
  sheetId: number,
  startRow1Based: number,
  count: number,
): Promise<void> {
  if (count <= 0) return;
  const sheets = getGoogleSheetsClient();
  const startIndex = startRow1Based - 1;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex,
              endIndex: startIndex + count,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });
}

/** Daily_Log 과거 행: 갱신 + 날짜 순서에 맞게 삽입(맨 아래 append 아님) */
export async function upsertDailyLogPastRows(
  spreadsheetId: string,
  sheetTitle: string,
  rowWidth: number,
  rows: { key: string; values: (string | number)[] }[],
  existingKeys: Map<string, number>,
  dateColumnIndex: number,
  dataRows: SheetCell[][] | null | undefined,
): Promise<{ inserted: number; updated: number }> {
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetTitle);
  const endCol = columnLetter(rowWidth);
  const sheetId = await getSheetId(spreadsheetId, sheetTitle);
  const snapshot = (dataRows ?? []).map((row) => (row ? [...row] : []));

  const toUpdate: { range: string; values: (string | number)[][] }[] = [];
  const toInsert: { key: string; values: (string | number)[] }[] = [];

  for (const row of rows) {
    const rowNum = existingKeys.get(row.key);
    if (rowNum) {
      toUpdate.push({
        range: `${quoted}!A${rowNum}:${endCol}${rowNum}`,
        values: [row.values],
      });
    } else {
      toInsert.push(row);
    }
  }

  if (toUpdate.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: toUpdate,
      },
    });
  }

  if (toInsert.length === 0) {
    return { inserted: 0, updated: toUpdate.length };
  }

  const insertPlan = toInsert.map((row) => ({
    row,
    at: findDailyLogInsertRow1Based(snapshot, dateColumnIndex, row.key),
  }));
  insertPlan.sort((a, b) => b.at - a.at);

  for (const { row, at } of insertPlan) {
    await insertBlankRowsAt(spreadsheetId, sheetId, at, 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoted}!A${at}:${endCol}${at}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row.values] },
    });
    const idx = at - 2;
    snapshot.splice(idx, 0, row.values.map((v) => v));
  }

  return { inserted: toInsert.length, updated: toUpdate.length };
}
