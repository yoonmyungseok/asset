import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM-dd");
}

export function formatDisplayDate(date: string): string {
  return format(parseISO(date), "M월 d일 (EEE)", { locale: ko });
}

export function todayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function parseDurationToSeconds(value: string): number | null {
  const parts = value.split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return null;

  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  return null;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonResponse<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}
