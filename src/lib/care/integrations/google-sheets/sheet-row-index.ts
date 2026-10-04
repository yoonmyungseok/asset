import { normalizeDateKey, normalizeSplitKey } from "@/lib/care/integrations/google-sheets/sheet-date";
import type { RunningUpsertKey, SplitUpsertKey } from "@/lib/care/integrations/google-sheets/header-map";

export type SheetRowIndexOptions = {
  /** Daily_Log: 이 날짜(yyyy-MM-dd) 행은 pin으로 처리하므로 인덱스에서 제외 */
  excludeDateKey?: string;
};

export function buildRunningRowIndex(
  values: (string | number | boolean | null | undefined)[][] | null | undefined,
  upsertKey: RunningUpsertKey,
  columns: Map<string, number>,
  options?: SheetRowIndexOptions,
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
    if (options?.excludeDateKey && upsertKey === "date" && key === options.excludeDateKey) {
      continue;
    }
    map.set(key, i + 2);
  }
  return map;
}

export function buildSplitRowIndex(
  values: (string | number | boolean | null | undefined)[][] | null | undefined,
  upsertKey: SplitUpsertKey,
  columns: Map<string, number>,
  options?: SheetRowIndexOptions,
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
      if (options?.excludeDateKey && datePart === options.excludeDateKey) {
        continue;
      }
      key = `${datePart}:${splitPart}`;
    }
    map.set(key, i + 2);
  }
  return map;
}
