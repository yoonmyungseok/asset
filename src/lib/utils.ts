import { randomUUID } from "crypto";
import { differenceInCalendarDays, isBefore, startOfDay } from "date-fns";
import Decimal from "decimal.js";

import { toDecimal } from "@/lib/decimal";

export const ASSET_CLASS_STOCK = "stock";
export const ASSET_CLASS_DEPOSIT = "deposit";
const DAYS_PER_YEAR = new Decimal(365);

export interface HoldingLike {
  asset_class?: string;
  quantity: Decimal.Value;
  interest_rate?: Decimal.Value | null;
  start_date?: Date | null;
  maturity_date?: Date | null;
  last_market_price?: Decimal.Value | null;
  manual_price?: Decimal.Value | null;
  avg_cost_price?: Decimal.Value | null;
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

  const endDate = holdingInterestAccrualEnd(holding, asOf);
  const days = differenceInCalendarDays(endDate, startOfDay(startDate));
  if (days <= 0) {
    return new Decimal(0);
  }

  const accrued = principal
    .times(rateDecimal)
    .div(100)
    .times(days)
    .div(DAYS_PER_YEAR);
  return accrued.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function holdingCurrentPrice(holding: HoldingLike): Decimal {
  if (isDepositHolding(holding)) {
    return new Decimal(1);
  }
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
  return toDecimal(holding.quantity).times(holdingCurrentPrice(holding));
}

export function holdingCostBasis(holding: HoldingLike): Decimal {
  return toDecimal(holding.quantity).times(toDecimal(holding.avg_cost_price));
}
