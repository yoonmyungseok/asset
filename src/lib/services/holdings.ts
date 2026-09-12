import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { roundAvgCostPrice } from "@/lib/decimal";
import { prisma } from "@/lib/db";
import { getQuote, RateLimitError } from "@/lib/external/market-data";
import { ServiceError } from "@/lib/service-error";
import { removeHolding } from "@/lib/services/core";
import {
  ASSET_CLASS_DEPOSIT,
  generateDepositSymbol,
  isDepositHolding,
  normalizeDepositHolding,
} from "@/lib/utils";
import type { holdingCreateSchema } from "@/lib/validations/account";
import type { z } from "zod";

type HoldingCreate = z.infer<typeof holdingCreateSchema>;

export async function applyMarketQuote(holding: {
  asset_class?: string;
  symbol: string;
  name: string;
  quantity: Decimal.Value;
  last_market_price?: Decimal | null;
  last_price_updated_at?: Date | null;
}): Promise<void> {
  if (isDepositHolding(holding)) {
    return;
  }
  try {
    const quote = await getQuote(holding.symbol);
    holding.last_market_price = quote.price;
    holding.last_price_updated_at = new Date();
    if (quote.name) {
      holding.name = quote.name;
    }
  } catch {
    // silent swallow (matches Python ValueError/RateLimitError on create)
  }
}

export function prepareHoldingFields(payload: HoldingCreate) {
  if (payload.asset_class === ASSET_CLASS_DEPOSIT) {
    return {
      asset_class: payload.asset_class,
      symbol: payload.symbol ?? generateDepositSymbol(),
      name: payload.name,
      quantity: payload.quantity,
      avg_cost_price: roundAvgCostPrice(payload.avg_cost_price ?? 1),
      manual_price: payload.avg_cost_price ?? new Decimal(1),
      interest_rate: payload.interest_rate ?? null,
      start_date: payload.start_date ?? new Date(),
      maturity_date: payload.maturity_date ?? null,
    };
  }
  return {
    asset_class: payload.asset_class,
    symbol: payload.symbol!,
    name: payload.name,
    quantity: payload.quantity,
    avg_cost_price: roundAvgCostPrice(payload.avg_cost_price!),
    book_cost: payload.book_cost ?? null,
    manual_price: null,
    interest_rate: null,
    start_date: null,
    maturity_date: null,
  };
}

export async function refreshPrices(holdingIds?: number[] | null) {
  const holdings = await prisma.holding.findMany({
    where: {
      quantity: { gt: 0 },
      asset_class: { not: ASSET_CLASS_DEPOSIT },
      ...(holdingIds?.length ? { id: { in: holdingIds } } : {}),
    },
  });

  let updated = 0;
  const failed: Array<{ holding_id: number; symbol: string; reason: string }> = [];

  for (const holding of holdings) {
    try {
      const quote = await getQuote(holding.symbol);
      await prisma.holding.update({
        where: { id: holding.id },
        data: {
          last_market_price: quote.price,
          last_price_updated_at: new Date(),
          ...(quote.name ? { name: quote.name } : {}),
        },
      });
      updated += 1;
    } catch (error) {
      if (error instanceof RateLimitError) {
        failed.push({
          holding_id: holding.id,
          symbol: holding.symbol,
          reason: "시세 서버 요청 한도 초과",
        });
        break;
      }
      failed.push({
        holding_id: holding.id,
        symbol: holding.symbol,
        reason: "시세 조회 실패",
      });
    }
  }

  return { updated, failed };
}

export async function createHolding(payload: HoldingCreate) {
  const account = await prisma.account.findUnique({
    where: { id: payload.account_id },
    include: { account_type: true },
  });
  if (!account) {
    throw new ServiceError(404, "계좌를 찾을 수 없습니다.");
  }
  if (!account.account_type.supports_holdings) {
    throw new ServiceError(400, "이 계좌 유형은 보유 종목을 지원하지 않습니다.");
  }

  const fields = prepareHoldingFields(payload);
  const holding = await prisma.holding.create({
    data: { account_id: payload.account_id, ...fields },
    include: { account: true },
  });

  if (isDepositHolding(holding)) {
    normalizeDepositHolding(holding);
  }
  await applyMarketQuote(holding);

  return prisma.holding.update({
    where: { id: holding.id },
    data: {
      last_market_price: holding.last_market_price,
      last_price_updated_at: holding.last_price_updated_at,
      name: holding.name,
      avg_cost_price: holding.avg_cost_price,
      manual_price: holding.manual_price,
    },
    include: { account: true },
  });
}

export async function updateHolding(
  holdingId: number,
  data: Prisma.HoldingUpdateInput,
) {
  const existing = await prisma.holding.findUnique({
    where: { id: holdingId },
    include: { account: true },
  });
  if (!existing) {
    throw new ServiceError(404, "보유 종목을 찾을 수 없습니다.");
  }

  const updated = await prisma.holding.update({
    where: { id: holdingId },
    data,
    include: { account: true },
  });

  if (isDepositHolding(updated)) {
    normalizeDepositHolding(updated);
    return prisma.holding.update({
      where: { id: holdingId },
      data: {
        avg_cost_price: updated.avg_cost_price,
        manual_price: updated.manual_price,
      },
      include: { account: true },
    });
  }

  return updated;
}

export async function deleteHolding(holdingId: number) {
  const holding = await prisma.holding.findUnique({ where: { id: holdingId } });
  if (!holding) {
    throw new ServiceError(404, "보유 종목을 찾을 수 없습니다.");
  }
  await removeHolding(prisma, holding);
}
