import { isServiceAccountConfigured } from "@/lib/care/integrations/google-sheets/service-account";
import {
  getKstDateString,
  getKstTimeString,
  readAccountSheetsConfig,
  resolveAccountSpreadsheetId,
} from "@/lib/services/account-sheets-config";
import { exportTargetAccountsToGoogleSheets } from "@/lib/services/account-sheets-export";

const CHECK_INTERVAL_MS = 60_000;
const ERROR_RETRY_COOLDOWN_MS = 15 * 60_000;

const globalForScheduler = globalThis as typeof globalThis & {
  __accountSheetsSchedulerStarted?: boolean;
  __accountSheetsLastErrorAt?: number;
};

export async function runScheduledAccountSheetsCheck(now: Date = new Date()): Promise<boolean> {
  const config = readAccountSheetsConfig();
  if (!config.enabled) {
    return false;
  }

  const todayKst = getKstDateString(now);
  if (config.lastScheduledDateKst === todayKst) {
    return false;
  }

  const currentTimeKst = getKstTimeString(now);
  if (currentTimeKst < config.scheduleTime) {
    return false;
  }

  if (!isServiceAccountConfigured()) {
    return false;
  }

  const { spreadsheetId } = await resolveAccountSpreadsheetId(config);
  if (!spreadsheetId) {
    return false;
  }

  const lastErrorAt = globalForScheduler.__accountSheetsLastErrorAt ?? 0;
  if (Date.now() - lastErrorAt < ERROR_RETRY_COOLDOWN_MS) {
    return false;
  }

  try {
    await exportTargetAccountsToGoogleSheets({
      refreshMarketPrices: true,
      trigger: "schedule",
    });
    globalForScheduler.__accountSheetsLastErrorAt = 0;
    return true;
  } catch (error) {
    globalForScheduler.__accountSheetsLastErrorAt = Date.now();
    console.error("[AccountSheetsScheduler] Scheduled export failed:", error);
    return false;
  }
}

export function startAccountSheetsScheduler(): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  if (globalForScheduler.__accountSheetsSchedulerStarted) {
    return;
  }
  globalForScheduler.__accountSheetsSchedulerStarted = true;

  const timer = setInterval(() => {
    void runScheduledAccountSheetsCheck();
  }, CHECK_INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  // 앱이 오전 스케줄 시각 이후에 기동된 경우에도 오늘 미실행 상태면 1회 확인한다.
  void runScheduledAccountSheetsCheck();
}
