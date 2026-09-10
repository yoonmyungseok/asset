import Decimal from "decimal.js";

import { prisma } from "@/lib/db";
import { toDecimal } from "@/lib/decimal";
import {
  applySqliteDateRange,
  monthSqliteDateBounds,
} from "@/lib/sqlite-date-filter";
import { getQuote, RateLimitError } from "@/lib/external/market-data";
import { ASSET_CLASS_DEPOSIT } from "@/lib/utils";

export async function refreshPrices(holdingIds?: number[]) {
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

export async function generateRecurringItems(year: number, month: number) {
  const items = await prisma.recurringItem.findMany({
    where: { is_active: true },
    include: {
      category: { include: { parent: true } },
      payment_method: true,
      account: { select: { name: true } },
      to_account: { select: { name: true } },
      card: true,
    },
    orderBy: { id: "asc" },
  });

  let generated = 0;
  let skipped = 0;
  const results: Array<{
    recurring_item_id: number;
    ledger_transaction_id?: number;
    status: string;
  }> = [];

  const { from, to } = monthSqliteDateBounds(year, month);

  for (const item of items) {
    const memo = item.memo ?? `정기 ${item.type}`;
    const existing = await prisma.ledgerTransaction.findFirst({
      where: await applySqliteDateRange(
        {
          type: item.type,
          category_id: item.category_id,
          amount: item.amount,
          memo,
        },
        "ledger_transactions",
        from,
        to,
      ),
    });

    if (existing) {
      skipped += 1;
      results.push({ recurring_item_id: item.id, status: "already_exists" });
      continue;
    }

    const day = Math.min(item.day_of_month, 28);
    const txDate = new Date(year, month - 1, day);

    const tx = await prisma.ledgerTransaction.create({
      data: {
        transaction_date: txDate,
        type: item.type,
        amount: item.amount,
        category_id: item.category_id,
        payment_method_id: item.payment_method_id,
        account_id: item.account_id,
        to_account_id: item.to_account_id,
        card_id: item.card_id,
        merchant: item.merchant,
        memo,
        is_fixed: true,
      },
    });

    generated += 1;
    results.push({
      recurring_item_id: item.id,
      ledger_transaction_id: tx.id,
      status: "created",
    });
  }

  return { generated, skipped, items: results };
}
