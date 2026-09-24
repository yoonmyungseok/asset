import { formatDate } from "@/lib/care/utils";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/** 시트·DB 날짜를 upsert 키용 YYYY-MM-DD로 통일 */
export function normalizeDateKey(value: unknown): string {
  if (value == null || value === "") return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + value * 86_400_000;
    return formatDate(new Date(ms));
  }

  const raw = String(value).trim();
  if (ISO_DATE.test(raw)) return raw.slice(0, 10);

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }

  return raw;
}

export function normalizeSplitKey(value: unknown): string {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (Number.isFinite(n)) return String(Math.trunc(n));
  return String(value).trim();
}
