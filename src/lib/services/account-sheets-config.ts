import fs from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/db";

export type AccountSheetsConfig = {
  enabled: boolean;
  scheduleTime: string;
  spreadsheetId: string | null;
  sheetName: string;
  lastRunAt: string | null;
  lastSuccessDateKst: string | null;
  lastScheduledDateKst: string | null;
  lastStatus: "success" | "error" | null;
  lastMessage: string | null;
};

const DEFAULT_CONFIG: AccountSheetsConfig = {
  enabled: true,
  scheduleTime: "08:30",
  spreadsheetId: null,
  sheetName: "Summary",
  lastRunAt: null,
  lastSuccessDateKst: null,
  lastScheduledDateKst: null,
  lastStatus: null,
  lastMessage: null,
};

function getConfigPath(): string {
  return path.join(process.cwd(), "data", "asset-sheets-config.json");
}

export function getKstDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getKstTimeString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function getKstDateTimeString(date: Date = new Date()): string {
  return `${getKstDateString(date)} ${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)}`;
}

export function readAccountSheetsConfig(): AccountSheetsConfig {
  const filePath = getConfigPath();
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AccountSheetsConfig>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_CONFIG.enabled,
      scheduleTime:
        typeof parsed.scheduleTime === "string" && /^\d{2}:\d{2}$/.test(parsed.scheduleTime)
          ? parsed.scheduleTime
          : DEFAULT_CONFIG.scheduleTime,
      spreadsheetId:
        typeof parsed.spreadsheetId === "string" && parsed.spreadsheetId.trim()
          ? parsed.spreadsheetId.trim()
          : null,
      sheetName:
        typeof parsed.sheetName === "string" && parsed.sheetName.trim()
          ? parsed.sheetName.trim()
          : DEFAULT_CONFIG.sheetName,
      lastRunAt: typeof parsed.lastRunAt === "string" ? parsed.lastRunAt : null,
      lastSuccessDateKst:
        typeof parsed.lastSuccessDateKst === "string" ? parsed.lastSuccessDateKst : null,
      lastScheduledDateKst:
        typeof parsed.lastScheduledDateKst === "string" ? parsed.lastScheduledDateKst : null,
      lastStatus:
        parsed.lastStatus === "success" || parsed.lastStatus === "error"
          ? parsed.lastStatus
          : null,
      lastMessage: typeof parsed.lastMessage === "string" ? parsed.lastMessage : null,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeAccountSheetsConfig(
  patch: Partial<AccountSheetsConfig>,
): AccountSheetsConfig {
  const current = readAccountSheetsConfig();
  const next: AccountSheetsConfig = {
    ...current,
    ...patch,
    sheetName: (patch.sheetName ?? current.sheetName).trim() || DEFAULT_CONFIG.sheetName,
  };
  const filePath = getConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function resolveAccountSpreadsheetId(
  config: AccountSheetsConfig = readAccountSheetsConfig(),
): Promise<{ spreadsheetId: string | null; source: "config" | "env" | "health_settings" | null }> {
  if (config.spreadsheetId) {
    return { spreadsheetId: config.spreadsheetId, source: "config" };
  }

  const fromAssetEnv = process.env.GOOGLE_ASSET_SPREADSHEET_ID?.trim();
  if (fromAssetEnv) {
    return { spreadsheetId: fromAssetEnv, source: "env" };
  }

  const fromEnv = process.env.GOOGLE_SPREADSHEET_ID?.trim();
  if (fromEnv) {
    return { spreadsheetId: fromEnv, source: "env" };
  }

  try {
    const rows = await prisma.$queryRaw<{ googleSpreadsheetId: string | null }[]>`
      SELECT googleSpreadsheetId FROM UserSettings ORDER BY id ASC LIMIT 1
    `;
    const stored = rows[0]?.googleSpreadsheetId?.trim();
    if (stored) {
      return { spreadsheetId: stored, source: "health_settings" };
    }
  } catch {
    // UserSettings 테이블이 아직 없는 환경에서도 안전하게 fallback
  }

  return { spreadsheetId: null, source: null };
}
