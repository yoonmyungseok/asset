import Decimal from "decimal.js";

import { getGoogleSheetsClient, quoteSheetName } from "@/lib/care/integrations/google-sheets/client";
import { isServiceAccountConfigured } from "@/lib/care/integrations/google-sheets/service-account";
import { upsertSheetRows } from "@/lib/care/integrations/google-sheets/sheet-upsert";
import { prisma } from "@/lib/db";
import { toDecimal } from "@/lib/decimal";
import {
  getKstDateString,
  getKstDateTimeString,
  readAccountSheetsConfig,
  resolveAccountSpreadsheetId,
  writeAccountSheetsConfig,
} from "@/lib/services/account-sheets-config";
import { refreshPrices } from "@/lib/services/holdings";
import { ASSET_CLASS_DEPOSIT, holdingCostBasis, holdingMarketValue } from "@/lib/utils";

export const TARGET_ACCOUNT_TYPE_CODES = ["ISA", "DC_PENSION"] as const;

export const ACCOUNT_SHEET_HEADERS = [
  "날짜",
  "ISA 평가금액",
  "ISA 투자원금",
  "ISA 평가손익",
  "ISA 수익률(%)",
  "ISA 예수금",
  "DC 평가금액",
  "DC 투자원금",
  "DC 평가손익",
  "DC 수익률(%)",
  "DC 예수금",
  "합계 평가금액",
  "합계 투자원금",
  "합계 평가손익",
  "합계 수익률(%)",
  "갱신시각",
] as const;

export type AccountSnapshotSummary = {
  id: number;
  name: string;
  institution: string | null;
  typeCode: string;
  cashBalance: number;
  totalValue: number;
  investedCost: number;
  profitLoss: number;
  profitRate: number;
};

export type AccountSheetsExportResult = {
  date: string;
  spreadsheetId: string;
  sheetName: string;
  action: "inserted" | "updated";
  priceRefresh: {
    updated: number;
    failedCount: number;
  };
  accounts: AccountSnapshotSummary[];
  totals: {
    totalValue: number;
    investedCost: number;
    profitLoss: number;
    profitRate: number;
  };
  exportedAt: string;
};

let inFlightExport: Promise<AccountSheetsExportResult> | null = null;

function roundWon(value: Decimal): number {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

function roundRate(value: Decimal): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

async function ensureSheetTabAndHeaders(
  spreadsheetId: string,
  sheetName: string,
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === sheetName);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
  }

  const quoted = quoteSheetName(sheetName);
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoted}!1:1`,
  });
  const firstRow = headerRes.data.values?.[0];
  if (!firstRow || firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoted}!A1:P1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[...ACCOUNT_SHEET_HEADERS]],
      },
    });
  }
}

async function readDateRowIndex(
  spreadsheetId: string,
  sheetName: string,
): Promise<Map<string, number>> {
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetName);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoted}!A2:A`,
  });
  const map = new Map<string, number>();
  const rows = res.data.values ?? [];
  rows.forEach((row, index) => {
    const cell = String(row?.[0] ?? "").trim();
    if (cell) {
      map.set(cell, index + 2);
    }
  });
  return map;
}

export async function getTargetAccountsPreview(): Promise<
  Array<{ id: number; name: string; institution: string | null; typeCode: string; typeName: string }>
> {
  const accounts = await prisma.account.findMany({
    where: {
      is_active: true,
      account_type: { code: { in: [...TARGET_ACCOUNT_TYPE_CODES] } },
    },
    include: { account_type: true },
    orderBy: { id: "asc" },
  });

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    typeCode: a.account_type.code,
    typeName: a.account_type.name,
  }));
}

function summarizeAccountGroup(
  accounts: Array<{
    id: number;
    name: string;
    institution: string | null;
    cash_balance: Decimal.Value;
    account_type: { code: string };
    holdings: Array<{
      asset_class: string;
      quantity: Decimal.Value;
      avg_cost_price: Decimal.Value;
      book_cost: Decimal.Value | null;
      manual_price: Decimal.Value | null;
      interest_rate: Decimal.Value | null;
      start_date: Date | null;
      maturity_date: Date | null;
      last_market_price: Decimal.Value | null;
    }>;
  }>,
) {
  let cash = new Decimal(0);
  let totalValue = new Decimal(0);
  let investedCost = new Decimal(0);

  const items: AccountSnapshotSummary[] = accounts.map((account) => {
    const accountCash = toDecimal(account.cash_balance);
    const holdingsValue = account.holdings.reduce(
      (sum, h) => sum.plus(holdingMarketValue(h)),
      new Decimal(0),
    );
    const holdingsCost = account.holdings.reduce(
      (sum, h) => sum.plus(holdingCostBasis(h)),
      new Decimal(0),
    );
    const acctTotal = accountCash.plus(holdingsValue);
    const acctCost = accountCash.plus(holdingsCost);
    const acctProfit = acctTotal.minus(acctCost);
    const acctRate = acctCost.gt(0) ? acctProfit.div(acctCost).times(100) : new Decimal(0);

    cash = cash.plus(accountCash);
    totalValue = totalValue.plus(acctTotal);
    investedCost = investedCost.plus(acctCost);

    return {
      id: account.id,
      name: account.name,
      institution: account.institution,
      typeCode: account.account_type.code,
      cashBalance: roundWon(accountCash),
      totalValue: roundWon(acctTotal),
      investedCost: roundWon(acctCost),
      profitLoss: roundWon(acctProfit),
      profitRate: roundRate(acctRate),
    };
  });

  const profitLoss = totalValue.minus(investedCost);
  const profitRate = investedCost.gt(0) ? profitLoss.div(investedCost).times(100) : new Decimal(0);

  return {
    items,
    cash: roundWon(cash),
    totalValue: roundWon(totalValue),
    investedCost: roundWon(investedCost),
    profitLoss: roundWon(profitLoss),
    profitRate: roundRate(profitRate),
  };
}

export function buildAccountExportRowValues(
  dateStr: string,
  exportedAtKst: string,
  isa: ReturnType<typeof summarizeAccountGroup>,
  dc: ReturnType<typeof summarizeAccountGroup>,
): (string | number)[] {
  const sumTotalValue = isa.totalValue + dc.totalValue;
  const sumInvestedCost = isa.investedCost + dc.investedCost;
  const sumProfitLoss = sumTotalValue - sumInvestedCost;
  const sumProfitRate =
    sumInvestedCost > 0
      ? new Decimal(sumProfitLoss).div(sumInvestedCost).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
      : 0;

  return [
    dateStr,
    isa.totalValue,
    isa.investedCost,
    isa.profitLoss,
    isa.profitRate,
    isa.cash,
    dc.totalValue,
    dc.investedCost,
    dc.profitLoss,
    dc.profitRate,
    dc.cash,
    sumTotalValue,
    sumInvestedCost,
    sumProfitLoss,
    sumProfitRate,
    exportedAtKst,
  ];
}

async function runExport(options?: {
  refreshMarketPrices?: boolean;
}): Promise<AccountSheetsExportResult> {
  if (!isServiceAccountConfigured()) {
    throw new Error(
      "Google 서비스 계정이 설정되지 않았습니다. .env 또는 google-service-account.json 설정을 확인하세요.",
    );
  }

  const config = readAccountSheetsConfig();
  const { spreadsheetId } = await resolveAccountSpreadsheetId(config);
  if (!spreadsheetId) {
    throw new Error(
      "구글 스프레드시트 ID가 설정되지 않았습니다. 설정 > 구글 시트에서 스프레드시트 URL 또는 ID를 저장해 주세요.",
    );
  }

  const targetAccountsBefore = await prisma.account.findMany({
    where: {
      is_active: true,
      account_type: { code: { in: [...TARGET_ACCOUNT_TYPE_CODES] } },
    },
    include: {
      account_type: true,
      holdings: {
        where: { quantity: { gt: 0 } },
      },
    },
    orderBy: { id: "asc" },
  });

  if (targetAccountsBefore.length === 0) {
    throw new Error("활성화된 중개형 ISA 또는 DC퇴직연금 계좌가 없습니다.");
  }

  let priceRefresh = { updated: 0, failedCount: 0 };
  if (options?.refreshMarketPrices !== false) {
    const refreshIds = targetAccountsBefore
      .flatMap((a) => a.holdings)
      .filter((h) => h.asset_class !== ASSET_CLASS_DEPOSIT)
      .map((h) => h.id);

    if (refreshIds.length > 0) {
      const res = await refreshPrices(refreshIds);
      priceRefresh = {
        updated: res.updated,
        failedCount: res.failed.length,
      };
    }
  }

  const targetAccounts = await prisma.account.findMany({
    where: {
      id: { in: targetAccountsBefore.map((a) => a.id) },
    },
    include: {
      account_type: true,
      holdings: {
        where: { quantity: { gt: 0 } },
      },
    },
    orderBy: { id: "asc" },
  });

  const isaGroup = summarizeAccountGroup(
    targetAccounts.filter((a) => a.account_type.code === "ISA"),
  );
  const dcGroup = summarizeAccountGroup(
    targetAccounts.filter((a) => a.account_type.code === "DC_PENSION"),
  );

  const now = new Date();
  const dateStr = getKstDateString(now);
  const exportedAtKst = getKstDateTimeString(now);
  const rowValues = buildAccountExportRowValues(dateStr, exportedAtKst, isaGroup, dcGroup);

  await ensureSheetTabAndHeaders(spreadsheetId, config.sheetName);
  const existingKeys = await readDateRowIndex(spreadsheetId, config.sheetName);

  const upsertRes = await upsertSheetRows(
    spreadsheetId,
    config.sheetName,
    ACCOUNT_SHEET_HEADERS.length,
    [{ key: dateStr, values: rowValues }],
    existingKeys,
  );

  const action = upsertRes.updated > 0 ? "updated" : "inserted";
  const allAccounts = [...isaGroup.items, ...dcGroup.items];
  const totalValue = isaGroup.totalValue + dcGroup.totalValue;
  const investedCost = isaGroup.investedCost + dcGroup.investedCost;
  const profitLoss = totalValue - investedCost;
  const profitRate =
    investedCost > 0
      ? new Decimal(profitLoss).div(investedCost).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
      : 0;

  writeAccountSheetsConfig({
    lastRunAt: now.toISOString(),
    lastSuccessDateKst: dateStr,
    lastStatus: "success",
    lastMessage: `${dateStr} 기준 ${action === "updated" ? "업데이트" : "추가"} 완료 (시세 ${priceRefresh.updated}건 갱신)`,
  });

  return {
    date: dateStr,
    spreadsheetId,
    sheetName: config.sheetName,
    action,
    priceRefresh,
    accounts: allAccounts,
    totals: {
      totalValue,
      investedCost,
      profitLoss,
      profitRate,
    },
    exportedAt: now.toISOString(),
  };
}

export async function exportTargetAccountsToGoogleSheets(options?: {
  refreshMarketPrices?: boolean;
}): Promise<AccountSheetsExportResult> {
  if (inFlightExport) {
    return inFlightExport;
  }

  inFlightExport = runExport(options).catch((error) => {
    const message = error instanceof Error ? error.message : "구글 시트 전송에 실패했습니다.";
    writeAccountSheetsConfig({
      lastRunAt: new Date().toISOString(),
      lastStatus: "error",
      lastMessage: message,
    });
    throw error;
  });

  try {
    return await inFlightExport;
  } finally {
    inFlightExport = null;
  }
}
