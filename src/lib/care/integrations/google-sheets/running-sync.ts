import { prisma } from "@/lib/db";
import { getGoogleSheetsClient, quoteSheetName } from "@/lib/care/integrations/google-sheets/client";
import {
  buildColumnIndex,
  buildSheetRow,
  parseHeaderAliasesJson,
  requireSheetColumns,
  resolveRunningHeaderAliases,
  resolveRunningUpsertKey,
  resolveSplitHeaderAliases,
  resolveSplitUpsertKey,
  sheetRowWidth,
  type RunningUpsertKey,
  type SplitUpsertKey,
} from "@/lib/care/integrations/google-sheets/header-map";
import {
  pickRecordsForDailySheet,
  pickRecordsForSplitSheet,
  recordToRunningFieldsForSheet,
  splitToFieldsForSheet,
} from "@/lib/care/integrations/google-sheets/running-sheet-export";
import {
  recordToRunningFields,
  RUNNING_SHEET_HEADERS,
  RUNNING_SPLIT_SHEET_HEADERS,
  splitToFields,
} from "@/lib/care/integrations/google-sheets/running-rows";
import { normalizeDateKey, normalizeSplitKey } from "@/lib/care/integrations/google-sheets/sheet-date";
import { pinTodayDailyLogRow, pinTodaySplitRows } from "@/lib/care/integrations/google-sheets/sheet-today-pin";
import { upsertSheetRows } from "@/lib/care/integrations/google-sheets/sheet-upsert";
import { todayString } from "@/lib/care/utils";
import { getRestDayTypeValues } from "@/lib/care/services/running-types";
import { isServiceAccountConfigured } from "@/lib/care/integrations/google-sheets/service-account";
import {
  getGoogleSheetsSettings,
  updateGoogleSheetsLastSyncedAt,
} from "@/lib/care/services/google-sheets-settings";

export interface RunningSheetsSyncResult {
  running: { inserted: number; updated: number };
  splits: { inserted: number; updated: number };
  syncedAt: string;
}

async function ensureSheetTab(
  spreadsheetId: string,
  sheetTitle: string,
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === sheetTitle);
  if (exists) return;

  throw new Error(
    `스프레드시트에 "${sheetTitle}" 탭이 없습니다. 기존 파일에 탭을 만든 뒤 설정의 탭 이름과 맞춰 주세요.`,
  );
}

async function readHeaderRow(spreadsheetId: string, sheetTitle: string): Promise<string[]> {
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetTitle);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoted}!1:1`,
  });
  const row = res.data.values?.[0];
  if (!row?.length) {
    throw new Error(
      `시트 "${sheetTitle}" 1행에 헤더가 없습니다. 시트에 이미 쓰고 있는 열 이름을 1행에 두거나, 설정에서 헤더 매핑을 지정하세요.`,
    );
  }
  return row.map((cell) => String(cell ?? ""));
}

function columnLetter(index1Based: number): string {
  let n = index1Based;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function resolveSplitSheetName(runningSheetName: string, configuredSplitName: string): string {
  if (
    runningSheetName === "Daily_Log" &&
    (configuredSplitName === "러닝_스플릿" || configuredSplitName === "러닝")
  ) {
    return "러닝_구간_기록";
  }
  return configuredSplitName;
}

function buildRunningRowIndex(
  values: (string | number | boolean | null | undefined)[][] | null | undefined,
  upsertKey: RunningUpsertKey,
  columns: Map<string, number>,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!values) return map;

  const keyCol =
    upsertKey === "record_id" ? columns.get("record_id") : columns.get("date");
  if (keyCol == null) return map;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row?.length) continue;
    const raw = row[keyCol];
    const key =
      upsertKey === "record_id"
        ? String(raw ?? "")
        : normalizeDateKey(raw);
    if (!key) continue;
    map.set(key, i + 2);
  }
  return map;
}

function buildSplitRowIndex(
  values: (string | number | boolean | null | undefined)[][] | null | undefined,
  upsertKey: SplitUpsertKey,
  columns: Map<string, number>,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!values) return map;

  const dateCol = columns.get("date");
  const splitCol = columns.get("split_number");
  const recordIdCol = columns.get("record_id");
  if (dateCol == null || splitCol == null) return map;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row?.length) continue;
    const splitPart = normalizeSplitKey(row[splitCol]);
    if (!splitPart) continue;

    let key: string;
    if (upsertKey === "record_id_split") {
      if (recordIdCol == null) continue;
      const recordId = row[recordIdCol];
      if (recordId == null || recordId === "") continue;
      key = `${recordId}:${splitPart}`;
    } else {
      const datePart = normalizeDateKey(row[dateCol]);
      if (!datePart) continue;
      key = `${datePart}:${splitPart}`;
    }
    map.set(key, i + 2);
  }
  return map;
}

export function resolveSpreadsheetId(storedId: string | null | undefined): string | null {
  const fromEnv = process.env.GOOGLE_SPREADSHEET_ID?.trim();
  if (storedId?.trim()) return storedId.trim();
  if (fromEnv) return fromEnv;
  return null;
}

export async function syncRunningToGoogleSheets(): Promise<RunningSheetsSyncResult> {
  const sheetSettings = await getGoogleSheetsSettings();
  const spreadsheetId = resolveSpreadsheetId(sheetSettings.googleSpreadsheetId);
  if (!spreadsheetId) {
    throw new Error(
      "스프레드시트 ID가 설정되지 않았습니다. 설정 → Google 스프레드시트에서 URL을 입력한 뒤 「스프레드시트 설정 저장」을 눌러 주세요.",
    );
  }

  const runningSheetName = sheetSettings.googleRunningSheetName;
  const splitSheetName = resolveSplitSheetName(
    runningSheetName,
    sheetSettings.googleRunningSplitSheetName,
  );
  const syncedAt = new Date().toISOString();
  const [records, types, restDayTypeValues] = await Promise.all([
    prisma.runningRecord.findMany({
      include: { splits: { orderBy: { splitNumber: "asc" } } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.runningType.findMany({ orderBy: { sortOrder: "asc" } }),
    getRestDayTypeValues(),
  ]);

  const typeOptions = types.map(({ value, label }) => ({ value, label }));

  await ensureSheetTab(spreadsheetId, runningSheetName);
  await ensureSheetTab(spreadsheetId, splitSheetName);

  const [runningHeaderRow, splitHeaderRow] = await Promise.all([
    readHeaderRow(spreadsheetId, runningSheetName),
    readHeaderRow(spreadsheetId, splitSheetName),
  ]);

  const runningAliases = resolveRunningHeaderAliases(
    parseHeaderAliasesJson(sheetSettings.googleRunningHeaderMap),
    runningHeaderRow,
  );
  const splitAliases = resolveSplitHeaderAliases(
    parseHeaderAliasesJson(sheetSettings.googleRunningSplitHeaderMap),
    splitHeaderRow,
  );

  const runningColumns = buildColumnIndex(runningHeaderRow, RUNNING_SHEET_HEADERS, runningAliases);
  const splitColumns = buildColumnIndex(splitHeaderRow, RUNNING_SPLIT_SHEET_HEADERS, splitAliases);

  const runningUpsertKey = resolveRunningUpsertKey(
    sheetSettings.googleRunningUpsertKey,
    runningColumns,
  );
  const splitUpsertKey = resolveSplitUpsertKey(
    sheetSettings.googleRunningSplitUpsertKey,
    splitColumns,
  );

  requireSheetColumns(
    runningColumns,
    runningUpsertKey === "record_id" ? ["record_id"] : ["date"],
    runningHeaderRow,
  );
  requireSheetColumns(
    splitColumns,
    splitUpsertKey === "record_id_split"
      ? ["record_id", "split_number"]
      : ["date", "split_number"],
    splitHeaderRow,
  );

  const runningWidth = sheetRowWidth(runningHeaderRow);
  const splitWidth = sheetRowWidth(splitHeaderRow);

  const sheets = getGoogleSheetsClient();
  const runningQuoted = quoteSheetName(runningSheetName);
  const splitQuoted = quoteSheetName(splitSheetName);
  const runningEndCol = columnLetter(runningWidth);
  const splitEndCol = columnLetter(splitWidth);

  const [runningExisting, splitExisting] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${runningQuoted}!A2:${runningEndCol}`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${splitQuoted}!A2:${splitEndCol}`,
    }),
  ]);

  const runningRowByKey = buildRunningRowIndex(
    runningExisting.data.values,
    runningUpsertKey,
    runningColumns,
  );
  const splitRowByKey = buildSplitRowIndex(
    splitExisting.data.values,
    splitUpsertKey,
    splitColumns,
  );

  const runningSource =
    runningUpsertKey === "date"
      ? pickRecordsForDailySheet(records, restDayTypeValues)
      : records;

  const runningRows = runningSource.map((record) => {
    const fields =
      runningUpsertKey === "date"
        ? recordToRunningFieldsForSheet(record, typeOptions, restDayTypeValues)
        : recordToRunningFields(record, typeOptions, syncedAt);
    const key =
      runningUpsertKey === "date"
        ? normalizeDateKey(record.date)
        : String(record.id);
    return {
      key,
      values: buildSheetRow(fields, runningColumns, runningWidth),
    };
  });

  const datesForSplits = new Set(runningSource.map((r) => r.date));
  const splitSourceRecords =
    runningUpsertKey === "date"
      ? pickRecordsForSplitSheet(records, datesForSplits)
      : records.filter((r) => r.splits.length > 0);

  const splitRows: { key: string; values: (string | number)[] }[] = [];
  for (const record of splitSourceRecords) {
    for (const split of record.splits) {
      const fields =
        splitUpsertKey === "date_split"
          ? splitToFieldsForSheet(record, split)
          : splitToFields(record, split);
      const key =
        splitUpsertKey === "date_split"
          ? `${normalizeDateKey(record.date)}:${normalizeSplitKey(split.splitNumber)}`
          : `${record.id}:${split.splitNumber}`;
      splitRows.push({
        key,
        values: buildSheetRow(fields, splitColumns, splitWidth),
      });
    }
  }

  const headers = runningHeaderRow.map((h) => String(h).trim());
  const isDailyLog =
    runningUpsertKey === "date" &&
    (runningSheetName === "Daily_Log" ||
      (headers.includes("날짜") && headers.includes("종류")));
  const todayKey = todayString();

  let running: { inserted: number; updated: number };
  let splits: { inserted: number; updated: number };

  if (isDailyLog) {
    const todayRecord = runningSource.find((r) => r.date === todayKey);
    const dateCol = runningColumns.get("date");
    if (!todayRecord || dateCol == null) {
      running = { inserted: 0, updated: 0 };
    } else {
      const fields = recordToRunningFieldsForSheet(
        todayRecord,
        typeOptions,
        restDayTypeValues,
      );
      const todayValues = buildSheetRow(fields, runningColumns, runningWidth);
      const pin = await pinTodayDailyLogRow(
        spreadsheetId,
        runningSheetName,
        runningWidth,
        todayKey,
        todayValues,
        runningExisting.data.values,
        dateCol,
      );
      running = {
        inserted: pin.inserted ? 1 : 0,
        updated: pin.updated ? 1 : 0,
      };
    }

    const todaySplitRecord = pickRecordsForSplitSheet(records, new Set([todayKey]))[0];
    const splitDateCol = splitColumns.get("date");
    if (!todaySplitRecord || splitDateCol == null || todaySplitRecord.splits.length === 0) {
      splits = { inserted: 0, updated: 0 };
    } else {
      const splitValueRows = todaySplitRecord.splits.map((split) => {
        const fields = splitToFieldsForSheet(todaySplitRecord, split);
        return buildSheetRow(fields, splitColumns, splitWidth);
      });
      const pinSplits = await pinTodaySplitRows(
        spreadsheetId,
        splitSheetName,
        splitWidth,
        todayKey,
        splitValueRows,
        splitExisting.data.values,
        splitDateCol,
      );
      splits = { inserted: pinSplits.rowCount, updated: 0 };
    }
  } else {
    running = await upsertSheetRows(
      spreadsheetId,
      runningSheetName,
      runningWidth,
      runningRows,
      runningRowByKey,
    );

    splits = await upsertSheetRows(
      spreadsheetId,
      splitSheetName,
      splitWidth,
      splitRows,
      splitRowByKey,
    );
  }

  await updateGoogleSheetsLastSyncedAt(syncedAt);

  return { running, splits, syncedAt };
}

export function isGoogleSheetsConfigured(): boolean {
  return isServiceAccountConfigured();
}
