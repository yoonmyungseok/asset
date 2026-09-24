import { getGoogleSheetsClient, quoteSheetName } from "@/lib/care/integrations/google-sheets/client";
import { normalizeDateKey } from "@/lib/care/integrations/google-sheets/sheet-date";
import { columnLetter, getSheetId } from "@/lib/care/integrations/google-sheets/sheet-upsert";

type SheetCell = string | number | boolean | null | undefined;

async function deleteRows1Based(
  spreadsheetId: string,
  sheetId: number,
  rowNumbers: number[],
): Promise<void> {
  if (rowNumbers.length === 0) return;
  const sheets = getGoogleSheetsClient();
  const sorted = [...new Set(rowNumbers)].sort((a, b) => b - a);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: sorted.map((row) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: row - 1,
            endIndex: row,
          },
        },
      })),
    },
  });
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

/** Daily_Log: 오늘 날짜 행을 항상 2행에 */
export async function pinTodayDailyLogRow(
  spreadsheetId: string,
  sheetTitle: string,
  rowWidth: number,
  todayKey: string,
  todayValues: (string | number)[],
  dataRows: SheetCell[][] | null | undefined,
  dateColumnIndex: number,
): Promise<{ updated: boolean; inserted: boolean }> {
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetTitle);
  const endCol = columnLetter(rowWidth);
  const sheetId = await getSheetId(spreadsheetId, sheetTitle);
  const rows = dataRows ?? [];

  const todayBelowRow2: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const sheetRow = i + 2;
    if (sheetRow === 2) continue;
    const row = rows[i];
    if (!row?.length) continue;
    if (normalizeDateKey(row[dateColumnIndex]) === todayKey) {
      todayBelowRow2.push(sheetRow);
    }
  }
  await deleteRows1Based(spreadsheetId, sheetId, todayBelowRow2);

  const row2 = rows[0];
  const row2Date =
    row2?.length && dateColumnIndex != null
      ? normalizeDateKey(row2[dateColumnIndex])
      : "";

  if (row2Date === todayKey) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoted}!A2:${endCol}2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [todayValues] },
    });
    return { updated: true, inserted: false };
  }

  if (rows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoted}!A2:${endCol}2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [todayValues] },
    });
    return { updated: false, inserted: true };
  }

  await insertBlankRowsAt(spreadsheetId, sheetId, 2, 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoted}!A2:${endCol}2`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [todayValues] },
  });
  return { updated: false, inserted: true };
}

/** 러닝_구간_기록: 오늘 구간을 항상 2행부터 */
export async function pinTodaySplitRows(
  spreadsheetId: string,
  sheetTitle: string,
  rowWidth: number,
  todayKey: string,
  splitValueRows: (string | number)[][],
  dataRows: SheetCell[][] | null | undefined,
  dateColumnIndex: number,
): Promise<{ rowCount: number }> {
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetTitle);
  const endCol = columnLetter(rowWidth);
  const sheetId = await getSheetId(spreadsheetId, sheetTitle);
  const rows = dataRows ?? [];

  const todayRows: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.length) continue;
    if (normalizeDateKey(row[dateColumnIndex]) === todayKey) {
      todayRows.push(i + 2);
    }
  }
  await deleteRows1Based(spreadsheetId, sheetId, todayRows);

  if (splitValueRows.length === 0) {
    return { rowCount: 0 };
  }

  await insertBlankRowsAt(spreadsheetId, sheetId, 2, splitValueRows.length);
  const endRow = 2 + splitValueRows.length - 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoted}!A2:${endCol}${endRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: splitValueRows },
  });
  return { rowCount: splitValueRows.length };
}
