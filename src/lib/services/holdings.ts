import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { roundAvgCostPrice } from "@/lib/decimal";
import { prisma } from "@/lib/db";
import { getQuote, RateLimitError } from "@/lib/external/market-data";
import { getCryptoQuote } from "@/lib/external/crypto-market-data";
import { ServiceError } from "@/lib/service-error";
import { applyBuy, removeHolding } from "@/lib/services/core";
import {
  ASSET_CLASS_DEPOSIT,
  generateDepositSymbol,
  holdingCostBasis,
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
    avg_cost_price: payload.asset_class === "crypto" ? payload.avg_cost_price!.toDecimalPlaces(12) : roundAvgCostPrice(payload.avg_cost_price!),
    book_cost: payload.book_cost == null ? null : payload.asset_class === "crypto" ? payload.book_cost.toDecimalPlaces(12) : payload.book_cost.toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
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
    include: { account: true },
  });

  let updated = 0;
  const failed: Array<{ holding_id: number; symbol: string; reason: string }> = [];

  for (const holding of holdings) {
    try {
      // 암호화폐는 계좌에 지정된 거래소의 원화 시세를 사용한다.
      const quote = holding.asset_class === "crypto"
        ? { price: await getCryptoQuote(holding.account.institution, holding.symbol), name: null }
        : await getQuote(holding.symbol);
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

  // 거래소의 보유 자산은 암호화폐로만 등록한다.
  const isCryptoAccount = account.account_type.code === "CRYPTO_EXCHANGE";
  if (isCryptoAccount !== (payload.asset_class === "crypto")) {
    throw new ServiceError(400, "계좌와 자산 유형이 일치하지 않습니다.");
  }
  if (isCryptoAccount) {
    payload.symbol = payload.symbol?.trim().toUpperCase();
    if (!payload.symbol || !/^[A-Z0-9]{1,20}$/.test(payload.symbol) || payload.quantity.lte(0) || !payload.avg_cost_price?.gt(0)) {
      throw new ServiceError(400, "코인 심볼과 양수인 수량·평단가를 입력해 주세요.");
    }
  }

  const fields = prepareHoldingFields(payload);
  const holding = await prisma.$transaction(async (db) => {
    // 예금은 금리와 만기가 다를 수 있으므로 같은 이름이어도 별도로 보관한다.
    const existing = fields.asset_class === ASSET_CLASS_DEPOSIT ? null : await db.holding.findFirst({
      where: { account_id: payload.account_id, symbol: fields.symbol, asset_class: { not: ASSET_CLASS_DEPOSIT } },
      orderBy: { id: "asc" },
    });
    if (!existing) {
      return db.holding.create({
        data: { account_id: payload.account_id, ...fields },
        include: { account: true },
      });
    }

    if (existing.asset_class === "crypto" && await db.investmentTransaction.findFirst({ where: { holding_id: existing.id, type: { in: ["buy", "sell"] } } })) {
      throw new ServiceError(400, "매매 내역이 있는 코인은 매수 거래로 추가해 주세요.");
    }

    // 명시된 장부금액이 있으면 각 보유분의 실제 금액을 보존한다.
    const combinedBookCost = existing.asset_class === "crypto" || existing.book_cost != null || payload.book_cost != null
      ? holdingCostBasis(existing).plus(holdingCostBasis(fields))
      : null;
    applyBuy(existing, fields.quantity, fields.avg_cost_price);
    if (existing.asset_class === "crypto" && combinedBookCost != null) {
      // 같은 코인을 합칠 때에도 소수점 원가와 평단을 유지한다.
      existing.avg_cost_price = combinedBookCost.div(existing.quantity).toDecimalPlaces(12, Decimal.ROUND_HALF_UP);
    }
    return db.holding.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity, avg_cost_price: existing.avg_cost_price, book_cost: combinedBookCost },
      include: { account: true },
    });
  });

  if (isDepositHolding(holding)) {
    normalizeDepositHolding(holding);
  }
  // 암호화폐는 주식 시세 검색 대신 거래소 시세 갱신을 사용한다.
  if (holding.asset_class !== "crypto") await applyMarketQuote(holding);

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

  if (existing.asset_class === "crypto") {
    if (data.asset_class !== undefined && data.asset_class !== "crypto") throw new ServiceError(400, "암호화폐의 자산 유형은 변경할 수 없습니다.");
    const hasTrades = await prisma.investmentTransaction.findFirst({ where: { holding_id: holdingId, type: { in: ["buy", "sell"] } } });
    const changed = (value: unknown, original: Decimal.Value | null) => value !== undefined && (value === null ? original !== null : !new Decimal(value as Decimal.Value).eq(original ?? 0));
    if (hasTrades && (changed(data.quantity, existing.quantity) || changed(data.avg_cost_price, existing.avg_cost_price) || changed(data.book_cost, holdingCostBasis(existing)))) {
      throw new ServiceError(400, "매매 내역이 있는 코인의 수량과 원가는 거래 내역에서 변경해 주세요.");
    }
    if (data.manual_price != null && new Decimal(data.manual_price as Decimal.Value).lte(0)) throw new ServiceError(400, "수동 현재가는 양수여야 합니다.");
  }
  if (existing.asset_class !== "crypto" && data.asset_class === "crypto") throw new ServiceError(400, "기존 보유 종목의 유형은 변경할 수 없습니다.");
  // 기존 자산의 평단 반올림 규칙을 유지하면서 코인은 더 작은 단가를 보존한다.
  if (data.avg_cost_price !== undefined && typeof data.avg_cost_price !== "object") data.avg_cost_price = existing.asset_class === "crypto" ? new Decimal(data.avg_cost_price).toDecimalPlaces(12) : roundAvgCostPrice(data.avg_cost_price);
  if (data.avg_cost_price instanceof Decimal) data.avg_cost_price = existing.asset_class === "crypto" ? data.avg_cost_price.toDecimalPlaces(12) : roundAvgCostPrice(data.avg_cost_price);
  if (data.book_cost instanceof Decimal) data.book_cost = data.book_cost.toDecimalPlaces(existing.asset_class === "crypto" ? 12 : 0, Decimal.ROUND_HALF_UP);

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
  if (holding.asset_class === "crypto" && await prisma.investmentTransaction.findFirst({ where: { holding_id: holding.id } })) {
    throw new ServiceError(400, "거래 내역이 있는 코인은 먼저 거래를 삭제해 주세요.");
  }
  await removeHolding(prisma, holding);
}
