import { getGoogleSheetsClient, quoteSheetName } from "@/lib/care/integrations/google-sheets/client";

export function columnLetter(index1Based: number): string {
  let n = index1Based;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export async function getSheetId(spreadsheetId: string, sheetTitle: string): Promise<number> {
  const sheets = getGoogleSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetTitle);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error(`시트 "${sheetTitle}"의 ID를 찾을 수 없습니다.`);
  }
  return sheetId;
}

export interface UpsertRowsOptions {
  /** 신규 행을 맨 아래 append 대신 이 행(1-based)부터 삽입 */
  insertNewRowsAt?: number;
  /** insertNewRowsAt 사용 시 새 행 정렬 (예: 날짜 내림차순) */
  sortNewRows?: (a: { key: string }, b: { key: string }) => number;
}

export async function upsertSheetRows(
  spreadsheetId: string,
  sheetTitle: string,
  rowWidth: number,
  rows: { key: string; values: (string | number)[] }[],
  existingKeys: Map<string, number>,
  options?: UpsertRowsOptions,
): Promise<{ inserted: number; updated: number }> {
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetTitle);
  const endCol = columnLetter(rowWidth);

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

  if (options?.sortNewRows) {
    toInsert.sort(options.sortNewRows);
  }

  const insertValues = toInsert.map((r) => r.values);

  if (options?.insertNewRowsAt != null && options.insertNewRowsAt >= 2) {
    const sheetId = await getSheetId(spreadsheetId, sheetTitle);
    const startRow = options.insertNewRowsAt;
    const startIndex = startRow - 1;

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
                endIndex: startIndex + insertValues.length,
              },
              inheritFromBefore: false,
            },
          },
        ],
      },
    });

    const endRow = startRow + insertValues.length - 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoted}!A${startRow}:${endCol}${endRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: insertValues },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoted}!A:${endCol}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: insertValues },
    });
  }

  return { inserted: toInsert.length, updated: toUpdate.length };
}
