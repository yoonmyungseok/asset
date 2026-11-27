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
import {
  ASSET_CLASS_DEPOSIT,
  holdingCostBasis,
  holdingCurrentPrice,
  holdingMarketValue,
} from "@/lib/utils";

export const TARGET_ACCOUNT_TYPE_CODES = ["ISA", "DC_PENSION"] as const;
export const DAILY_SUMMARY_TAB_NAME = "Daily_Summary";

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

export const HOLDING_HISTORY_HEADERS = [
  "기록 날짜",
  "현재가(KRW)",
  "평가금액(KRW)",
  "평가손익(KRW)",
  "수익률(%)",
  "갱신 시각",
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

export type HoldingDetailItem = {
  accountLabel: "ISA" | "DC";
  accountName: string;
  institution: string | null;
  symbol: string;
  name: string;
  tabName: string;
  quantity: number;
  avgCostPrice: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  profitLoss: number;
  profitRate: number;
  weightRate: number;
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
  holdingsCount: number;
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

export function formatHoldingTabName(accountLabel: "ISA" | "DC", symbol: string): string {
  const safeSymbol = symbol.replace(/[:\\/?*[\]]/g, "_").trim();
  return `${accountLabel}_${safeSymbol}`.slice(0, 95);
}

async function ensureSheetTab(spreadsheetId: string, sheetName: string): Promise<void> {
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
}

async function ensureSheetTabAndHeaders(
  spreadsheetId: string,
  sheetName: string,
  headers: readonly string[],
  headerRowNumber = 1,
): Promise<void> {
  await ensureSheetTab(spreadsheetId, sheetName);
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetName);
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoted}!${headerRowNumber}:${headerRowNumber}`,
  });
  const firstRow = headerRes.data.values?.[0];
  if (!firstRow || firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoted}!A${headerRowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[...headers]],
      },
    });
  }
}

async function readDateRowIndex(
  spreadsheetId: string,
  sheetName: string,
  startRow = 2,
): Promise<Map<string, number>> {
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetName);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoted}!A${startRow}:A`,
  });
  const map = new Map<string, number>();
  const rows = res.data.values ?? [];
  rows.forEach((row, index) => {
    const cell = String(row?.[0] ?? "").trim();
    if (cell) {
      map.set(cell, index + startRow);
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

type AccountWithHoldings = {
  id: number;
  name: string;
  institution: string | null;
  cash_balance: Decimal.Value;
  account_type: { code: string };
  holdings: Array<{
    asset_class: string;
    symbol: string;
    name: string;
    quantity: Decimal.Value;
    avg_cost_price: Decimal.Value;
    book_cost: Decimal.Value | null;
    manual_price: Decimal.Value | null;
    interest_rate: Decimal.Value | null;
    start_date: Date | null;
    maturity_date: Date | null;
    last_market_price: Decimal.Value | null;
  }>;
};

function summarizeAccountGroup(accounts: AccountWithHoldings[]) {
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

export function buildHoldingDetailItems(
  accounts: AccountWithHoldings[],
  totalPortfolioValue: number,
): HoldingDetailItem[] {
  const totalDec = new Decimal(totalPortfolioValue);
  const details: HoldingDetailItem[] = [];

  for (const account of accounts) {
    const accountLabel: "ISA" | "DC" = account.account_type.code === "ISA" ? "ISA" : "DC";
    for (const holding of account.holdings) {
      const marketValue = holdingMarketValue(holding);
      const costBasis = holdingCostBasis(holding);
      const profitLoss = marketValue.minus(costBasis);
      const profitRate = costBasis.gt(0) ? profitLoss.div(costBasis).times(100) : new Decimal(0);
      const weightRate = totalDec.gt(0) ? marketValue.div(totalDec).times(100) : new Decimal(0);

      details.push({
        accountLabel,
        accountName: account.name,
        institution: account.institution,
        symbol: holding.symbol,
        name: holding.name,
        tabName: formatHoldingTabName(accountLabel, holding.symbol),
        quantity: toDecimal(holding.quantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
        avgCostPrice: roundWon(toDecimal(holding.avg_cost_price)),
        currentPrice: roundWon(holdingCurrentPrice(holding)),
        costBasis: roundWon(costBasis),
        marketValue: roundWon(marketValue),
        profitLoss: roundWon(profitLoss),
        profitRate: roundRate(profitRate),
        weightRate: roundRate(weightRate),
      });
    }
  }

  return details;
}

export function buildSummarySheetRows(
  exportedAtKst: string,
  isa: ReturnType<typeof summarizeAccountGroup>,
  dc: ReturnType<typeof summarizeAccountGroup>,
  holdings: HoldingDetailItem[],
): (string | number)[][] {
  const totalValue = isa.totalValue + dc.totalValue;
  const investedCost = isa.investedCost + dc.investedCost;
  const profitLoss = totalValue - investedCost;
  const profitRate =
    investedCost > 0
      ? new Decimal(profitLoss).div(investedCost).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
      : 0;

  const accountRows = [...isa.items, ...dc.items].map((a) => [
    a.typeCode === "ISA" ? "중개형 ISA" : "DC퇴직연금",
    a.name,
    a.institution ?? "",
    a.cashBalance,
    a.investedCost,
    a.totalValue,
    a.profitLoss,
    `${a.profitRate}%`,
  ]);

  const holdingRows = holdings.map((h) => [
    h.accountLabel,
    h.name,
    h.symbol,
    h.quantity,
    h.avgCostPrice,
    h.currentPrice,
    h.costBasis,
    h.marketValue,
    h.profitLoss,
    `${h.profitRate}%`,
    `${h.weightRate}%`,
    h.tabName,
  ]);

  return [
    ["📊 중개형 ISA · DC퇴직연금 포트폴리오 종합 요약"],
    ["최종 동기화 시각", exportedAtKst, "", "총 보유 종목수", holdings.length, "종목"],
    [
      "총 투자원금(KRW)",
      investedCost,
      "",
      "총 평가금액(KRW)",
      totalValue,
      "",
      "총 평가손익(KRW)",
      profitLoss,
      `${profitRate}%`,
    ],
    [],
    ["[계좌별 요약]"],
    ["계좌구분", "계좌명", "금융사", "예수금(KRW)", "투자원금(KRW)", "평가금액(KRW)", "평가손익(KRW)", "수익률(%)"],
    ...accountRows,
    [],
    ["[종목별 상세 요약] (하단 시트 탭명에서 일별 추이를 확인할 수 있습니다)"],
    [
      "계좌",
      "종목명",
      "티커",
      "보유수량",
      "평단가(KRW)",
      "현재가(KRW)",
      "투자원금(KRW)",
      "평가금액(KRW)",
      "평가손익(KRW)",
      "수익률(%)",
      "비중(%)",
      "시트 탭명",
    ],
    ...holdingRows,
  ];
}

export function buildHoldingHeaderRows(
  exportedAtKst: string,
  item: HoldingDetailItem,
): (string | number)[][] {
  return [
    [`📈 ${item.accountLabel} - ${item.name} (${item.symbol})`],
    ["최종 갱신시각", exportedAtKst, "", "보유 상태", "보유 중"],
    ["총 보유수량", item.quantity, "", "평균 매수가(KRW)", item.avgCostPrice],
    ["현재 시장가(KRW)", item.currentPrice, "", "총 매수원금(KRW)", item.costBasis],
    ["현재 평가금액(KRW)", item.marketValue, "", "평가 손익(KRW)", item.profitLoss, `${item.profitRate}%`],
    [],
    ["[일별 시세 및 손익 히스토리]"],
    [...HOLDING_HISTORY_HEADERS],
  ];
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

async function writeSummaryTab(
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number)[][],
): Promise<void> {
  await ensureSheetTab(spreadsheetId, sheetName);
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(sheetName);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quoted}!A:Z`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoted}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}

async function writeHoldingTab(
  spreadsheetId: string,
  dateStr: string,
  exportedAtKst: string,
  item: HoldingDetailItem,
): Promise<void> {
  await ensureSheetTab(spreadsheetId, item.tabName);
  const sheets = getGoogleSheetsClient();
  const quoted = quoteSheetName(item.tabName);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoted}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: buildHoldingHeaderRows(exportedAtKst, item),
    },
  });

  const existingDates = await readDateRowIndex(spreadsheetId, item.tabName, 9);
  await upsertSheetRows(
    spreadsheetId,
    item.tabName,
    HOLDING_HISTORY_HEADERS.length,
    [
      {
        key: dateStr,
        values: [
          dateStr,
          item.currentPrice,
          item.marketValue,
          item.profitLoss,
          `${item.profitRate}%`,
          exportedAtKst,
        ],
      },
    ],
    existingDates,
  );
}

async function runExport(options?: {
  refreshMarketPrices?: boolean;
  trigger?: "manual" | "schedule";
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
        orderBy: { id: "asc" },
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
        orderBy: { id: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  const isaAccounts = targetAccounts.filter((a) => a.account_type.code === "ISA");
  const dcAccounts = targetAccounts.filter((a) => a.account_type.code === "DC_PENSION");

  const isaGroup = summarizeAccountGroup(isaAccounts);
  const dcGroup = summarizeAccountGroup(dcAccounts);

  const totalValue = isaGroup.totalValue + dcGroup.totalValue;
  const investedCost = isaGroup.investedCost + dcGroup.investedCost;
  const profitLoss = totalValue - investedCost;
  const profitRate =
    investedCost > 0
      ? new Decimal(profitLoss).div(investedCost).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
      : 0;

  const now = new Date();
  const dateStr = getKstDateString(now);
  const exportedAtKst = getKstDateTimeString(now);

  const holdingDetails = buildHoldingDetailItems(targetAccounts, totalValue);
  const summaryRows = buildSummarySheetRows(exportedAtKst, isaGroup, dcGroup, holdingDetails);
  await writeSummaryTab(spreadsheetId, config.sheetName, summaryRows);

  for (const item of holdingDetails) {
    await writeHoldingTab(spreadsheetId, dateStr, exportedAtKst, item);
  }

  // 계좌 전체 일별 합계 추이도 별도 탭(Daily_Summary)에 누적한다.
  await ensureSheetTabAndHeaders(spreadsheetId, DAILY_SUMMARY_TAB_NAME, ACCOUNT_SHEET_HEADERS);
  const existingDailyKeys = await readDateRowIndex(spreadsheetId, DAILY_SUMMARY_TAB_NAME, 2);
  const dailyRowValues = buildAccountExportRowValues(dateStr, exportedAtKst, isaGroup, dcGroup);
  const upsertRes = await upsertSheetRows(
    spreadsheetId,
    DAILY_SUMMARY_TAB_NAME,
    ACCOUNT_SHEET_HEADERS.length,
    [{ key: dateStr, values: dailyRowValues }],
    existingDailyKeys,
  );

  const action = upsertRes.updated > 0 ? "updated" : "inserted";
  const allAccounts = [...isaGroup.items, ...dcGroup.items];

  writeAccountSheetsConfig({
    lastRunAt: now.toISOString(),
    lastSuccessDateKst: dateStr,
    ...(options?.trigger === "schedule" ? { lastScheduledDateKst: dateStr } : {}),
    lastStatus: "success",
    lastMessage: `${dateStr} 기준 ${action === "updated" ? "업데이트" : "추가"} 완료 (${config.sheetName} + ${holdingDetails.length}개 종목 탭, 시세 ${priceRefresh.updated}건 갱신)`,
  });

  return {
    date: dateStr,
    spreadsheetId,
    sheetName: config.sheetName,
    action,
    priceRefresh,
    accounts: allAccounts,
    holdingsCount: holdingDetails.length,
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
  trigger?: "manual" | "schedule";
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
