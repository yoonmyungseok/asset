import { randomUUID } from "crypto";
import { differenceInMonths, isBefore, startOfDay } from "date-fns";
import Decimal from "decimal.js";

import { toDecimal } from "@/lib/decimal";

export const ASSET_CLASS_STOCK = "stock";
export const ASSET_CLASS_DEPOSIT = "deposit";

export interface HoldingLike {
  asset_class?: string;
  quantity: Decimal.Value;
  interest_rate?: Decimal.Value | null;
  start_date?: Date | null;
  maturity_date?: Date | null;
  last_market_price?: Decimal.Value | null;
  manual_price?: Decimal.Value | null;
  avg_cost_price?: Decimal.Value | null;
  book_cost?: Decimal.Value | null;
}

export function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

export function dumpMetadata(data: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  return data;
}

export function isDepositHolding(holding: HoldingLike): boolean {
  return (holding.asset_class ?? ASSET_CLASS_STOCK) === ASSET_CLASS_DEPOSIT;
}

export function generateDepositSymbol(): string {
  return `DEP.${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function normalizeDepositHolding(holding: {
  avg_cost_price: Decimal;
  manual_price: Decimal | null;
}): void {
  holding.avg_cost_price = new Decimal(1);
  holding.manual_price = new Decimal(1);
}

export function holdingInterestAccrualEnd(holding: HoldingLike, asOf?: Date): Date {
  const today = startOfDay(asOf ?? new Date());
  const maturityDate = holding.maturity_date ? startOfDay(holding.maturity_date) : null;
  if (maturityDate && isBefore(maturityDate, today)) {
    return maturityDate;
  }
  return today;
}

export function holdingInterestAccrualMonths(holding: HoldingLike, asOf?: Date): number {
  const startDate = holding.start_date;
  if (!startDate) {
    return 0;
  }

  const endDate = holdingInterestAccrualEnd(holding, asOf);
  return Math.max(0, differenceInMonths(endDate, startOfDay(startDate)));
}

export function holdingAccruedInterest(holding: HoldingLike, asOf?: Date): Decimal {
  if (!isDepositHolding(holding)) {
    return new Decimal(0);
  }

  const rate = holding.interest_rate;
  const startDate = holding.start_date;
  if (rate == null || startDate == null) {
    return new Decimal(0);
  }

  const rateDecimal = toDecimal(rate);
  if (rateDecimal.lte(0)) {
    return new Decimal(0);
  }

  const principal = toDecimal(holding.quantity);
  if (principal.lte(0)) {
    return new Decimal(0);
  }

  const months = holdingInterestAccrualMonths(holding, asOf);
  if (months <= 0) {
    return new Decimal(0);
  }

  const monthlyFactor = new Decimal(1).plus(rateDecimal.div(100).div(12));
  const accrued = principal.times(monthlyFactor.pow(months).minus(1));
  return accrued.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function holdingCurrentPrice(holding: HoldingLike): Decimal {
  if (isDepositHolding(holding)) {
    return new Decimal(1);
  }
  // 암호화폐의 수동 가격은 명시적으로 해제하기 전까지 우선한다.
  if (holding.asset_class === "crypto" && holding.manual_price != null) return toDecimal(holding.manual_price);
  if (holding.last_market_price != null) {
    return toDecimal(holding.last_market_price);
  }
  if (holding.manual_price != null) {
    return toDecimal(holding.manual_price);
  }
  return toDecimal(holding.avg_cost_price);
}

export function holdingMarketValue(holding: HoldingLike, asOf?: Date): Decimal {
  if (isDepositHolding(holding)) {
    return toDecimal(holding.quantity).plus(holdingAccruedInterest(holding, asOf));
  }
  return toDecimal(holding.quantity)
    .times(holdingCurrentPrice(holding))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

export function computeEstimatedBookCost(
  quantity: Decimal.Value,
  avgCostPrice: Decimal.Value,
): Decimal {
  return toDecimal(quantity)
    .times(toDecimal(avgCostPrice))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_DOWN);
}

export function holdingCostBasis(holding: HoldingLike): Decimal {
  // 암호화폐 수수료와 원가는 소수점 원까지 유지한다.
  if (holding.asset_class === "crypto") return holding.book_cost != null ? toDecimal(holding.book_cost) : toDecimal(holding.quantity).times(toDecimal(holding.avg_cost_price));
  if (holding.book_cost != null) {
    return toDecimal(holding.book_cost).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  }
  return computeEstimatedBookCost(holding.quantity, toDecimal(holding.avg_cost_price));
}

export function adjustBookCostOnBuy(
  holding: { book_cost?: Decimal.Value | null },
  buyAmount: Decimal.Value,
): void {
  holding.book_cost = toDecimal(holding.book_cost).plus(buyAmount);
}

export function adjustBookCostOnSell(
  holding: { quantity: Decimal.Value; book_cost?: Decimal.Value | null; asset_class?: string },
  sellQuantity: Decimal.Value,
  priorQuantity: Decimal.Value,
): void {
  const oldQty = toDecimal(priorQuantity);
  const sellQty = toDecimal(sellQuantity);
  const remainingQty = oldQty.minus(sellQty);
  if (remainingQty.lte(0)) {
    holding.book_cost = new Decimal(0);
    return;
  }

  const oldBookCost = toDecimal(holding.book_cost ?? holdingCostBasis(holding));
  holding.book_cost = oldBookCost
    .times(remainingQty.div(oldQty))
    .toDecimalPlaces(holding.asset_class === "crypto" ? 12 : 0, Decimal.ROUND_HALF_UP);
}

export function restoreBookCostOnSellReversal(
  holding: { quantity: Decimal.Value; book_cost?: Decimal.Value | null },
  restoreQuantity: Decimal.Value,
): void {
  const currentQty = toDecimal(holding.quantity);
  const restoreQty = toDecimal(restoreQuantity);
  if (currentQty.lte(0)) {
    return;
  }

  const priorTotalQty = currentQty.plus(restoreQty);
  holding.book_cost = toDecimal(holding.book_cost)
    .times(priorTotalQty.div(currentQty))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}
