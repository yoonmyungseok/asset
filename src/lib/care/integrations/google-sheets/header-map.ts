import { DAILY_LOG_KO_PRESET } from "@/lib/care/integrations/google-sheets/presets/daily-log-ko";

export type HeaderAliases = Record<string, string>;

export type RunningUpsertKey = "record_id" | "date";
export type SplitUpsertKey = "record_id_split" | "date_split";

function headerRowText(headerRow: string[]): string[] {
  return headerRow.map((h) => String(h ?? "").trim());
}

/** 저장된 매핑이 없을 때 시트 1행이 Daily_Log 형식이면 한글 헤더 매핑 자동 적용 */
export function resolveRunningHeaderAliases(
  saved: HeaderAliases | undefined,
  headerRow: string[],
): HeaderAliases | undefined {
  if (saved && Object.keys(saved).length > 0) return saved;
  const headers = headerRowText(headerRow);
  if (headers.includes("날짜") && headers.includes("종류")) {
    return { ...DAILY_LOG_KO_PRESET.googleRunningHeaderMap };
  }
  return saved;
}

export function resolveSplitHeaderAliases(
  saved: HeaderAliases | undefined,
  headerRow: string[],
): HeaderAliases | undefined {
  if (saved && Object.keys(saved).length > 0) return saved;
  const headers = headerRowText(headerRow);
  if (headers.includes("날짜") && headers.includes("구간")) {
    return { ...DAILY_LOG_KO_PRESET.googleRunningSplitHeaderMap };
  }
  return saved;
}

export function resolveRunningUpsertKey(
  configured: string,
  columns: Map<string, number>,
): RunningUpsertKey {
  if (configured === "date" && columns.has("date")) return "date";
  if (configured === "record_id" && columns.has("record_id")) return "record_id";
  if (columns.has("date")) return "date";
  if (columns.has("record_id")) return "record_id";
  return configured === "date" ? "date" : "record_id";
}

export function resolveSplitUpsertKey(
  configured: string,
  columns: Map<string, number>,
): SplitUpsertKey {
  if (configured === "date_split" && columns.has("date") && columns.has("split_number")) {
    return "date_split";
  }
  if (
    configured === "record_id_split" &&
    columns.has("record_id") &&
    columns.has("split_number")
  ) {
    return "record_id_split";
  }
  if (columns.has("date") && columns.has("split_number")) return "date_split";
  if (columns.has("record_id") && columns.has("split_number")) return "record_id_split";
  return configured === "date_split" ? "date_split" : "record_id_split";
}

/** 시트 1행 헤더 텍스트로 각 필드가 몇 번째 열인지 찾습니다 (0-based). */
export function buildColumnIndex(
  headerRow: string[],
  fields: readonly string[],
  aliases?: HeaderAliases,
): Map<string, number> {
  const normalized = headerRow.map((h) => String(h ?? "").trim());
  const map = new Map<string, number>();

  for (const field of fields) {
    const labels = [aliases?.[field], field].filter(
      (label): label is string => Boolean(label && label.length > 0),
    );
    for (const label of labels) {
      const idx = normalized.findIndex((h) => h === label);
      if (idx >= 0) {
        map.set(field, idx);
        break;
      }
    }
  }

  return map;
}

export function requireSheetColumns(
  map: Map<string, number>,
  required: readonly string[],
  headerRow: string[],
): void {
  const missing = required.filter((f) => !map.has(f));
  if (missing.length === 0) return;

  const visible = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);
  throw new Error(
    `시트 1행에서 필요한 열을 찾지 못했습니다: ${missing.join(", ")}. ` +
      `현재 헤더: ${visible.length > 0 ? visible.join(" | ") : "(비어 있음)"}. ` +
      `설정에서 「헤더 이름 매핑」으로 시트에 쓰인 이름을 지정할 수 있습니다.`,
  );
}

export function sheetRowWidth(headerRow: string[]): number {
  let width = 0;
  for (let i = headerRow.length - 1; i >= 0; i--) {
    if (String(headerRow[i] ?? "").trim() !== "") {
      width = i + 1;
      break;
    }
  }
  return Math.max(width, 1);
}

export function buildSheetRow(
  fields: Record<string, string | number>,
  columnIndex: Map<string, number>,
  width: number,
): (string | number)[] {
  const row: (string | number)[] = new Array(width).fill("");
  for (const [field, value] of Object.entries(fields)) {
    const idx = columnIndex.get(field);
    if (idx != null && idx < width) {
      row[idx] = value;
    }
  }
  return row;
}

export function parseHeaderAliasesJson(raw: string | null | undefined): HeaderAliases | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as HeaderAliases;
    }
  } catch {
    // ignore
  }
  return undefined;
}
