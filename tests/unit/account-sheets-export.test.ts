import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  ACCOUNT_SHEET_HEADERS,
  buildAccountExportRowValues,
} from "@/lib/services/account-sheets-export";
import { getKstDateString, getKstTimeString } from "@/lib/services/account-sheets-config";
import { runScheduledAccountSheetsCheck } from "@/lib/services/account-sheets-scheduler";
import * as configModule from "@/lib/services/account-sheets-config";
import * as exportModule from "@/lib/services/account-sheets-export";
import * as serviceAccountModule from "@/lib/care/integrations/google-sheets/service-account";

describe("account-sheets-export", () => {
  it("builds 16-column daily row matching headers", () => {
    const row = buildAccountExportRowValues(
      "2026-11-27",
      "2026-11-27 08:30:05",
      {
        items: [],
        cash: 100_000,
        totalValue: 11_100_000,
        investedCost: 10_100_000,
        profitLoss: 1_000_000,
        profitRate: 9.9,
      },
      {
        items: [],
        cash: 50_000,
        totalValue: 20_550_000,
        investedCost: 20_050_000,
        profitLoss: 500_000,
        profitRate: 2.49,
      },
    );

    expect(row).toHaveLength(ACCOUNT_SHEET_HEADERS.length);
    expect(row[0]).toBe("2026-11-27");
    expect(row[1]).toBe(11_100_000); // ISA 평가금액
    expect(row[6]).toBe(20_550_000); // DC 평가금액
    expect(row[11]).toBe(31_650_000); // 합계 평가금액
    expect(row[12]).toBe(30_150_000); // 합계 투자원금
    expect(row[13]).toBe(1_500_000); // 합계 평가손익
    expect(row[14]).toBe(4.98); // 합계 수익률(%)
    expect(row[15]).toBe("2026-11-27 08:30:05");
  });

  it("formats KST date and time correctly", () => {
    // 2026-11-26T23:35:00Z === 2026-11-27 08:35 KST
    const utcDate = new Date("2026-11-26T23:35:00.000Z");
    expect(getKstDateString(utcDate)).toBe("2026-11-27");
    expect(getKstTimeString(utcDate)).toBe("08:35");
  });
});

describe("account-sheets-scheduler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("skips before scheduled KST time", async () => {
    vi.spyOn(configModule, "readAccountSheetsConfig").mockReturnValue({
      enabled: true,
      scheduleTime: "08:30",
      spreadsheetId: "sheet-12345678901234567890",
      sheetName: "계좌_일별현황",
      lastRunAt: null,
      lastSuccessDateKst: null,
      lastStatus: null,
      lastMessage: null,
    });
    const exportSpy = vi.spyOn(exportModule, "exportTargetAccountsToGoogleSheets");

    // 08:25 KST
    const ran = await runScheduledAccountSheetsCheck(new Date("2026-11-26T23:25:00.000Z"));
    expect(ran).toBe(false);
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it("skips if already succeeded today in KST", async () => {
    vi.spyOn(configModule, "readAccountSheetsConfig").mockReturnValue({
      enabled: true,
      scheduleTime: "08:30",
      spreadsheetId: "sheet-12345678901234567890",
      sheetName: "계좌_일별현황",
      lastRunAt: "2026-11-26T23:30:00.000Z",
      lastSuccessDateKst: "2026-11-27",
      lastStatus: "success",
      lastMessage: "done",
    });
    const exportSpy = vi.spyOn(exportModule, "exportTargetAccountsToGoogleSheets");

    // 08:35 KST on 2026-11-27
    const ran = await runScheduledAccountSheetsCheck(new Date("2026-11-26T23:35:00.000Z"));
    expect(ran).toBe(false);
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it("runs export when enabled, past schedule time, and not yet run today", async () => {
    vi.spyOn(configModule, "readAccountSheetsConfig").mockReturnValue({
      enabled: true,
      scheduleTime: "08:30",
      spreadsheetId: "sheet-12345678901234567890",
      sheetName: "계좌_일별현황",
      lastRunAt: null,
      lastSuccessDateKst: "2026-11-26",
      lastStatus: "success",
      lastMessage: "prev",
    });
    vi.spyOn(serviceAccountModule, "isServiceAccountConfigured").mockReturnValue(true);
    const exportSpy = vi
      .spyOn(exportModule, "exportTargetAccountsToGoogleSheets")
      .mockResolvedValue({} as never);

    // 08:35 KST on 2026-11-27
    const ran = await runScheduledAccountSheetsCheck(new Date("2026-11-26T23:35:00.000Z"));
    expect(ran).toBe(true);
    expect(exportSpy).toHaveBeenCalledWith({ refreshMarketPrices: true });
  });
});
