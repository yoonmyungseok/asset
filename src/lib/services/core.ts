import type {
  Account,
  DailySnapshot,
  Holding,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import {
  applySqliteDateRange,
  monthSqliteDateBounds,
} from "@/lib/sqlite-date-filter";
import { toDecimal } from "@/lib/decimal";
import type { AccountResponse, AccountSummary, HoldingResponse } from "@/lib/validations/account";
import {
  dumpMetadata,
  holdingAccruedInterest,
  holdingCostBasis,
  holdingCurrentPrice,
  holdingMarketValue,
  isDepositHolding,
  parseMetadata,
} from "@/lib/utils";

type DbClient = PrismaClient | Prisma.TransactionClient;

const ACCOUNT_TYPE_SEEDS = [
  { code: "ISA", name: "ISA", category: "investment", supports_holdings: true, supports_contribution_limit: true, sort_order: 1 },
  { code: "IRP", name: "IRP", category: "pension", supports_holdings: true, supports_contribution_limit: true, sort_order: 2 },
  { code: "PENSION_SAVINGS", name: "연금저축", category: "pension", supports_holdings: true, supports_contribution_limit: true, sort_order: 3 },
  { code: "DC_PENSION", name: "DC퇴직연금", category: "pension", supports_holdings: true, supports_contribution_limit: false, sort_order: 4 },
  { code: "BROKERAGE", name: "일반증권", category: "investment", supports_holdings: true, supports_contribution_limit: false, sort_order: 5 },
  { code: "SAVINGS", name: "적금", category: "deposit", supports_holdings: false, supports_contribution_limit: false, sort_order: 6 },
  { code: "DEPOSIT", name: "예금", category: "deposit", supports_holdings: false, supports_contribution_limit: false, sort_order: 7 },
  { code: "CHECKING", name: "입출금", category: "cash", supports_holdings: false, supports_contribution_limit: false, sort_order: 8 },
] as const;

const PAYMENT_METHOD_SEEDS = ["현금", "카드", "계좌이체"] as const;

const CATEGORY_SEEDS = [
  { type: "expense", name: "식비", children: ["외식", "장보기", "카페"] },
  { type: "expense", name: "교통", children: ["대중교통", "주유", "택시"] },
  { type: "expense", name: "주거", children: ["월세", "관리비", "공과금"] },
  { type: "expense", name: "생활", children: ["통신비", "의료", "쇼핑", "카드대금"] },
  { type: "expense", name: "문화", children: ["여가", "구독"] },
  { type: "income", name: "급여", children: ["본봉", "상여"] },
  { type: "income", name: "기타수입", children: ["이자", "배당", "기타"] },
] as const;

export async function seedAccountTypes(db: DbClient = prisma): Promise<number> {
  let count = 0;
  for (const seed of ACCOUNT_TYPE_SEEDS) {
    const existing = await db.accountType.findUnique({ where: { code: seed.code } });
    if (existing) {
      await db.accountType.update({
        where: { id: existing.id },
        data: {
          name: seed.name,
          category: seed.category,
          supports_holdings: seed.supports_holdings,
          supports_contribution_limit: seed.supports_contribution_limit,
          sort_order: seed.sort_order,
        },
      });
      continue;
    }
    await db.accountType.create({
      data: {
        ...seed,
        is_system: true,
      },
    });
    count += 1;
  }
  return count;
}

export async function seedPaymentMethods(db: DbClient = prisma): Promise<number> {
  let count = 0;
  for (const name of PAYMENT_METHOD_SEEDS) {
    const exists = await db.paymentMethod.findUnique({ where: { name } });
    if (exists) {
      continue;
    }
    await db.paymentMethod.create({ data: { name, is_system: true } });
    count += 1;
  }
  return count;
}

export async function seedCategories(db: DbClient = prisma): Promise<number> {
  let count = 0;
  for (const { type, name, children } of CATEGORY_SEEDS) {
    let parent = await db.category.findFirst({
      where: { name, parent_id: null },
    });
    if (!parent) {
      parent = await db.category.create({
        data: {
          name,
          type,
          parent_id: null,
          is_system: true,
          sort_order: count,
          is_active: true,
        },
      });
      count += 1;
    }
    for (const [idx, childName] of children.entries()) {
      const exists = await db.category.findFirst({
        where: { name: childName, parent_id: parent.id },
      });
      if (exists) {
        continue;
      }
      await db.category.create({
        data: {
          name: childName,
          type,
          parent_id: parent.id,
          is_system: true,
          sort_order: idx,
          is_active: true,
        },
      });
      count += 1;
    }
  }
  return count;
}

export async function initializeAll(db: DbClient = prisma): Promise<Record<string, number>> {
  return {
    account_types: await seedAccountTypes(db),
    payment_methods: await seedPaymentMethods(db),
    categories: await seedCategories(db),
  };
}

export async function getAccountTotalValue(
  db: DbClient,
  account: Account & { account_type?: { supports_holdings: boolean } },
): Promise<Decimal> {
  let holdingsValue = new Decimal(0);
  if (account.account_type?.supports_holdings) {
    const holdings = await db.holding.findMany({
      where: {
        account_id: account.id,
        quantity: { gt: 0 },
      },
    });
    holdingsValue = holdings.reduce(
      (sum, holding) => sum.plus(holdingMarketValue(holding)),
      new Decimal(0),
    );
  }
  return toDecimal(account.cash_balance).plus(holdingsValue);
}

export async function getOrCreateYearlyLimit(db: DbClient, accountId: number, year: number) {
  const existing = await db.accountYearlyLimit.findFirst({
    where: { account_id: accountId, year },
  });
  if (existing) {
    return existing;
  }
  return db.accountYearlyLimit.create({
    data: {
      account_id: accountId,
      year,
    },
  });
}

export async function updateContributedAmount(db: DbClient, accountId: number, year: number): Promise<void> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    include: { account_type: true },
  });
  if (!account || !account.account_type.supports_contribution_limit) {
    return;
  }

  const from = `${year}-01-01T00:00:00.000Z`;
  const to = `${year}-12-31T23:59:59.999Z`;
  const aggregate = await db.investmentTransaction.aggregate({
    where: await applySqliteDateRange(
      {
        account_id: accountId,
        type: { in: ["deposit", "buy"] },
      },
      "investment_transactions",
      from,
      to,
      db,
    ),
    _sum: { amount: true },
  });

  const limit = await getOrCreateYearlyLimit(db, accountId, year);
  await db.accountYearlyLimit.update({
    where: { id: limit.id },
    data: { contributed_amount: toDecimal(aggregate._sum.amount) },
  });
}

export function applyBuy(holding: Holding, quantity: Decimal.Value, price: Decimal.Value): void {
  const buyQuantity = toDecimal(quantity);
  const buyPrice = toDecimal(price);
  const oldQty = toDecimal(holding.quantity);
  const newQty = oldQty.plus(buyQuantity);
  if (newQty.lte(0)) {
    holding.quantity = new Decimal(0);
    return;
  }
  const oldCost = oldQty.times(toDecimal(holding.avg_cost_price));
  const addedCost = buyQuantity.times(buyPrice);
  holding.avg_cost_price = oldCost.plus(addedCost).div(newQty);
  holding.quantity = newQty;
}

export function applySell(holding: Holding, quantity: Decimal.Value): void {
  const sellQuantity = toDecimal(quantity);
  const remaining = toDecimal(holding.quantity).minus(sellQuantity);
  holding.quantity = remaining.lt(0) ? new Decimal(0) : remaining;
}

export async function removeHolding(db: DbClient, holding: Holding): Promise<void> {
  await db.investmentTransaction.updateMany({
    where: { holding_id: holding.id },
    data: { holding_id: null },
  });
  await db.holding.delete({ where: { id: holding.id } });
}

export async function getOrCreateTag(db: DbClient, name: string) {
  const existing = await db.tag.findUnique({ where: { name } });
  if (existing) {
    return existing;
  }
  return db.tag.create({ data: { name } });
}

export async function getCategoryDescendantIds(db: DbClient, categoryId: number): Promise<number[]> {
  const ids = [categoryId];
  const children = await db.category.findMany({
    where: { parent_id: categoryId },
    select: { id: true },
  });
  for (const child of children) {
    const childIds = await getCategoryDescendantIds(db, child.id);
    ids.push(...childIds);
  }
  return ids;
}

export async function calculateBudgetSpent(
  db: DbClient,
  categoryId: number,
  year: number,
  month: number,
): Promise<Decimal> {
  const categoryIds = await getCategoryDescendantIds(db, categoryId);
  const { from, to } = monthSqliteDateBounds(year, month);
  const aggregate = await db.ledgerTransaction.aggregate({
    where: await applySqliteDateRange(
      {
        type: "expense",
        category_id: { in: categoryIds },
      },
      "ledger_transactions",
      from,
      to,
      db,
    ),
    _sum: { amount: true },
  });
  return toDecimal(aggregate._sum.amount);
}

export type AssetAggregate = {
  total_assets: Decimal;
  investment_total: Decimal;
  cash_total: Decimal;
  deposit_total: Decimal;
  checking_total: Decimal;
  total_liabilities: Decimal;
  net_worth: Decimal;
};

export async function aggregateAssets(db: DbClient = prisma): Promise<AssetAggregate> {
  const accounts = await db.account.findMany({
    where: { is_active: true },
    include: { account_type: true },
  });

  let investmentTotal = new Decimal(0);
  let cashTotal = new Decimal(0);
  let depositTotal = new Decimal(0);
  let totalAssets = new Decimal(0);

  for (const account of accounts) {
    const value = await getAccountTotalValue(db, account);
    totalAssets = totalAssets.plus(value);
    const category = account.account_type.category;
    if (category === "investment" || category === "pension") {
      investmentTotal = investmentTotal.plus(value);
    } else if (category === "deposit") {
      depositTotal = depositTotal.plus(value);
    } else {
      cashTotal = cashTotal.plus(value);
    }
  }

  const liabilities = await db.liability.aggregate({
    where: { is_active: true },
    _sum: { current_balance: true },
  });
  const totalLiabilities = toDecimal(liabilities._sum.current_balance);
  const combinedCash = cashTotal.plus(depositTotal);

  return {
    total_assets: totalAssets,
    investment_total: investmentTotal,
    cash_total: combinedCash,
    deposit_total: depositTotal,
    checking_total: cashTotal,
    total_liabilities: totalLiabilities,
    net_worth: totalAssets.minus(totalLiabilities),
  };
}

export async function saveDailySnapshot(
  db: DbClient = prisma,
  snapshotDate?: Date,
): Promise<DailySnapshot> {
  const dateValue = snapshotDate ?? new Date();
  const totals = await aggregateAssets(db);

  const snapshot = await db.dailySnapshot.upsert({
    where: { snapshot_date: dateValue },
    create: {
      snapshot_date: dateValue,
      total_assets: totals.total_assets,
      total_liabilities: totals.total_liabilities,
      net_worth: totals.net_worth,
      investment_total: totals.investment_total,
      cash_total: totals.cash_total,
    },
    update: {
      total_assets: totals.total_assets,
      total_liabilities: totals.total_liabilities,
      net_worth: totals.net_worth,
      investment_total: totals.investment_total,
      cash_total: totals.cash_total,
    },
  });

  const accounts = await db.account.findMany({ where: { is_active: true } });
  for (const account of accounts) {
    const value = await getAccountTotalValue(db, account);
    await db.accountSnapshot.upsert({
      where: {
        uq_account_snapshot: {
          snapshot_date: dateValue,
          account_id: account.id,
        },
      },
      create: {
        snapshot_date: dateValue,
        account_id: account.id,
        balance_value: value,
      },
      update: {
        balance_value: value,
      },
    });
  }

  const liabilities = await db.liability.findMany({ where: { is_active: true } });
  for (const liability of liabilities) {
    await db.liabilitySnapshot.upsert({
      where: {
        uq_liability_snapshot: {
          snapshot_date: dateValue,
          liability_id: liability.id,
        },
      },
      create: {
        snapshot_date: dateValue,
        liability_id: liability.id,
        balance_value: liability.current_balance,
      },
      update: {
        balance_value: liability.current_balance,
      },
    });
  }

  return snapshot;
}

export async function accountToResponse(
  db: DbClient,
  account: Account & { account_type: { id: number; code: string; name: string; category: string; supports_holdings: boolean } },
  includeSummary = false,
): Promise<AccountResponse> {
  const response: AccountResponse = {
    id: account.id,
    account_type_id: account.account_type_id,
    account_type: {
      id: account.account_type.id,
      code: account.account_type.code,
      name: account.account_type.name,
      category: account.account_type.category,
      supports_holdings: account.account_type.supports_holdings,
    },
    name: account.name,
    institution: account.institution,
    cash_balance: toDecimal(account.cash_balance),
    metadata: parseMetadata(account.metadata_json),
    is_active: account.is_active,
  };

  if (includeSummary) {
    const holdings = await db.holding.findMany({
      where: {
        account_id: account.id,
        quantity: { gt: 0 },
      },
    });
    const holdingsValue = holdings.reduce(
      (sum, holding) => sum.plus(holdingMarketValue(holding)),
      new Decimal(0),
    );
    const summary: AccountSummary = {
      holdings_count: holdings.length,
      holdings_value: holdingsValue,
      total_value: toDecimal(account.cash_balance).plus(holdingsValue),
    };
    response.summary = summary;
  }

  return response;
}

export function holdingToResponse(holding: Holding, accountName?: string | null): HoldingResponse {
  const accruedInterest = isDepositHolding(holding) ? holdingAccruedInterest(holding) : new Decimal(0);
  const marketValue = holdingMarketValue(holding);
  const costBasis = holdingCostBasis(holding);
  const profitLoss = marketValue.minus(costBasis);
  const profitLossRate = costBasis.gt(0) ? profitLoss.div(costBasis).times(100) : new Decimal(0);

  return {
    id: holding.id,
    account_id: holding.account_id,
    account_name: accountName ?? null,
    asset_class: holding.asset_class,
    symbol: holding.symbol,
    name: holding.name,
    quantity: toDecimal(holding.quantity),
    avg_cost_price: toDecimal(holding.avg_cost_price),
    manual_price: holding.manual_price != null ? toDecimal(holding.manual_price) : null,
    last_market_price: holding.last_market_price != null ? toDecimal(holding.last_market_price) : null,
    last_price_updated_at: holding.last_price_updated_at,
    current_price: holdingCurrentPrice(holding),
    market_value: marketValue,
    cost_basis: costBasis,
    profit_loss: profitLoss,
    profit_loss_rate: profitLossRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    interest_rate: holding.interest_rate != null ? toDecimal(holding.interest_rate) : null,
    start_date: holding.start_date,
    maturity_date: holding.maturity_date,
    accrued_interest: isDepositHolding(holding) ? accruedInterest : null,
  };
}

export function serializeAccountMetadata(data: Record<string, unknown> | null | undefined) {
  return dumpMetadata(data);
}
