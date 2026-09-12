import Decimal from "decimal.js";

const DEFAULT_DECIMAL = new Decimal(0);

export function toDecimal(
  value: Decimal.Value | null | undefined,
  defaultValue: Decimal = DEFAULT_DECIMAL,
): Decimal {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return new Decimal(value);
}

export function formatMoney(value: Decimal.Value | null | undefined): string {
  const amount = toDecimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return `${new Intl.NumberFormat("ko-KR").format(amount.toNumber())}원`;
}

export function serializeDecimal(value: Decimal.Value | null | undefined): string {
  return toDecimal(value).toFixed();
}

export function roundAvgCostPrice(value: Decimal.Value | null | undefined): Decimal {
  return toDecimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function roundAvgCostPriceDisplay(value: Decimal.Value | null | undefined): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
