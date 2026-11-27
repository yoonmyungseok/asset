import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  ACCOUNT_SHEET_HEADERS,
  HOLDING_HISTORY_HEADERS,
  buildAccountExportRowValues,
  buildHoldingDetailItems,
  buildHoldingHeaderRows,
  buildSummarySheetRows,
  formatHoldingTabName,
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
    expect(row[1]).toBe(11_100_000);
    expect(row[6]).toBe(20_550_000);
    expect(row[11]).toBe(31_650_000);
    expect(row[12]).toBe(30_150_000);
    expect(row[13]).toBe(1_500_000);
    expect(row[14]).toBe(4.98);
    expect(row[15]).toBe("2026-11-27 08:30:05");
  });

  it("formats KST date and time correctly", () => {
    const utcDate = new Date("2026-11-26T23:35:00.000Z");
    expect(getKstDateString(utcDate)).toBe("2026-11-27");
    expect(getKstTimeString(utcDate)).toBe("08:35");
  });

  it("builds Summary and per-holding tab rows matching reference structure", () => {
    const holdings = buildHoldingDetailItems(
      [
        {
          id: 21,
          name: "중개형 ISA",
          institution: "우리투자증권",
          cash_balance: 100_000,
          account_type: { code: "ISA" },
          holdings: [
            {
              asset_class: "stock",
              symbol: "379800.KS",
              name: "KODEX 미국S&P500",
              quantity: 50,
              avg_cost_price: 16_000,
              book_cost: null,
              manual_price: null,
              interest_rate: null,
              start_date: null,
              maturity_date: null,
              last_market_price: 18_000,
            },
          ],
        },
      ],
      1_000_000,
    );

    expect(holdings).toHaveLength(1);
    expect(holdings[0].tabName).toBe("ISA_379800.KS");
    expect(holdings[0].marketValue).toBe(900_000);
    expect(holdings[0].weightRate).toBe(90);

    const headerRows = buildHoldingHeaderRows("2026-11-28 08:30:00", holdings[0]);
    expect(headerRows).toHaveLength(8);
    expect(headerRows[7]).toEqual([...HOLDING_HISTORY_HEADERS]);

    const summaryRows = buildSummarySheetRows(
      "2026-11-28 08:30:00",
      {
        items: [
          {
            id: 21,
            name: "중개형 ISA",
            institution: "우리투자증권",
            typeCode: "ISA",
            cashBalance: 100_000,
            totalValue: 1_000_000,
            investedCost: 900_000,
            profitLoss: 100_000,
            profitRate: 11.11,
          },
        ],
        cash: 100_000,
        totalValue: 1_000_000,
        investedCost: 900_000,
        profitLoss: 100_000,
        profitRate: 11.11,
      },
      {
        items: [],
        cash: 0,
        totalValue: 0,
        investedCost: 0,
        profitLoss: 0,
        profitRate: 0,
      },
      holdings,
    );

    expect(summaryRows[0][0]).toContain("포트폴리오 종합 요약");
    expect(summaryRows.some((r) => r[0] === "ISA" && r[11] === "ISA_379800.KS")).toBe(true);
    expect(formatHoldingTabName("DC", "379800.KS")).toBe("DC_379800.KS");
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
      sheetName: "Summary",
      lastRunAt: null,
      lastSuccessDateKst: null,
      lastScheduledDateKst: null,
      lastStatus: null,
      lastMessage: null,
    });
    const exportSpy = vi.spyOn(exportModule, "exportTargetAccountsToGoogleSheets");

    const ran = await runScheduledAccountSheetsCheck(new Date("2026-11-26T23:25:00.000Z"));
    expect(ran).toBe(false);
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it("skips if scheduled run already succeeded today in KST", async () => {
    vi.spyOn(configModule, "readAccountSheetsConfig").mockReturnValue({
      enabled: true,
      scheduleTime: "08:30",
      spreadsheetId: "sheet-12345678901234567890",
      sheetName: "Summary",
      lastRunAt: "2026-11-26T23:30:00.000Z",
      lastSuccessDateKst: "2026-11-27",
      lastScheduledDateKst: "2026-11-27",
      lastStatus: "success",
      lastMessage: "done",
    });
    const exportSpy = vi.spyOn(exportModule, "exportTargetAccountsToGoogleSheets");

    const ran = await runScheduledAccountSheetsCheck(new Date("2026-11-26T23:35:00.000Z"));
    expect(ran).toBe(false);
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it("runs scheduled export even after an earlier manual export on the same KST date", async () => {
    vi.spyOn(configModule, "readAccountSheetsConfig").mockReturnValue({
      enabled: true,
      scheduleTime: "08:30",
      spreadsheetId: "sheet-12345678901234567890",
      sheetName: "Summary",
      lastRunAt: "2026-11-26T16:56:34.000Z",
      lastSuccessDateKst: "2026-11-27",
      lastScheduledDateKst: "2026-11-26",
      lastStatus: "success",
      lastMessage: "manual run",
    });
    vi.spyOn(serviceAccountModule, "isServiceAccountConfigured").mockReturnValue(true);
    const exportSpy = vi
      .spyOn(exportModule, "exportTargetAccountsToGoogleSheets")
      .mockResolvedValue({} as never);

    const ran = await runScheduledAccountSheetsCheck(new Date("2026-11-26T23:35:00.000Z"));
    expect(ran).toBe(true);
    expect(exportSpy).toHaveBeenCalledWith({ refreshMarketPrices: true, trigger: "schedule" });
  });
});
