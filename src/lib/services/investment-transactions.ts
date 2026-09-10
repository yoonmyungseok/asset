import type { Account, Holding, InvestmentTransaction, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import type { z } from "zod";

import { toDecimal } from "@/lib/decimal";
import { ServiceError } from "@/lib/service-error";
import {
  applyBuy,
  applySell,
  removeHolding,
  updateContributedAmount,
} from "@/lib/services/core";
import {
  ASSET_CLASS_DEPOSIT,
  generateDepositSymbol,
  isDepositHolding,
  normalizeDepositHolding,
} from "@/lib/utils";
import type { investmentTransactionCreateSchema } from "@/lib/validations/account";

type TxClient = Prisma.TransactionClient;
type InvestmentCreate = z.infer<typeof investmentTransactionCreateSchema>;

export async function resolveHolding(
  db: TxClient,
  account: Account,
  payload: InvestmentCreate,
): Promise<Holding> {
  if (payload.holding_id) {
    const holding = await db.holding.findUnique({ where: { id: payload.holding_id } });
    if (!holding || holding.account_id !== account.id) {
      throw new ServiceError(400, "유효하지 않은 보유 종목입니다.");
    }
    return holding;
  }

  const assetClass = payload.asset_class ?? "stock";

  if (assetClass === ASSET_CLASS_DEPOSIT) {
    if (!payload.name) {
      throw new ServiceError(400, "예금 상품명이 필요합니다.");
    }
    let holding = await db.holding.findFirst({
      where: {
        account_id: account.id,
        asset_class: ASSET_CLASS_DEPOSIT,
        name: payload.name,
      },
    });
    if (!holding) {
      holding = await db.holding.create({
        data: {
          account_id: account.id,
          asset_class: ASSET_CLASS_DEPOSIT,
          symbol: payload.symbol ?? generateDepositSymbol(),
          name: payload.name,
          quantity: 0,
          avg_cost_price: 1,
          manual_price: 1,
        },
      });
    }
    return holding;
  }

  if (!payload.symbol || !payload.name) {
    throw new ServiceError(400, "symbol과 name이 필요합니다.");
  }

  let holding = await db.holding.findFirst({
    where: { account_id: account.id, symbol: payload.symbol },
  });
  if (!holding) {
    holding = await db.holding.create({
      data: {
        account_id: account.id,
        asset_class: "stock",
        symbol: payload.symbol,
        name: payload.name,
        quantity: 0,
        avg_cost_price: 0,
      },
    });
  }
  return holding;
}

export async function applyTransactionEffects(
  db: TxClient,
  account: Account,
  holding: Holding | null,
  tx: InvestmentTransaction,
): Promise<void> {
  const amount = toDecimal(tx.amount);
  const fee = toDecimal(tx.fee);
  let cashBalance = toDecimal(account.cash_balance);
  let holdingRemoved = false;

  switch (tx.type) {
    case "buy": {
      if (!holding) {
        throw new ServiceError(400, "매수 거래에는 보유 종목이 필요합니다.");
      }
      if (isDepositHolding(holding)) {
        const quantity = tx.quantity != null ? toDecimal(tx.quantity) : amount;
        normalizeDepositHolding(holding);
        applyBuy(holding, quantity, new Decimal(1));
      } else {
        applyBuy(holding, toDecimal(tx.quantity), toDecimal(tx.price));
      }
      cashBalance = cashBalance.minus(amount).minus(fee);
      break;
    }
    case "sell": {
      if (!holding) {
        throw new ServiceError(400, "매도 거래에는 보유 종목이 필요합니다.");
      }
      const sellQty = tx.quantity != null ? toDecimal(tx.quantity) : amount;
      applySell(holding, sellQty);
      cashBalance = cashBalance.plus(amount).minus(fee);
      if (toDecimal(holding.quantity).lte(0)) {
        tx.holding_id = null;
        await removeHolding(db, holding);
        holdingRemoved = true;
      }
      break;
    }
    case "deposit":
      cashBalance = cashBalance.plus(amount);
      break;
    case "withdraw":
    case "fee":
      cashBalance = cashBalance.minus(amount);
      break;
    case "dividend":
    case "interest": {
      if (holding && isDepositHolding(holding) && tx.type === "interest") {
        normalizeDepositHolding(holding);
        applyBuy(holding, amount, new Decimal(1));
        holding.start_date = tx.transaction_date;
      } else {
        cashBalance = cashBalance.plus(amount);
      }
      break;
    }
  }

  await db.account.update({
    where: { id: account.id },
    data: { cash_balance: cashBalance },
  });
  account.cash_balance = cashBalance;

  if (holding && !holdingRemoved) {
    const exists = await db.holding.findUnique({ where: { id: holding.id } });
    if (exists) {
      await db.holding.update({
        where: { id: holding.id },
        data: {
          quantity: holding.quantity,
          avg_cost_price: holding.avg_cost_price,
          manual_price: holding.manual_price,
          start_date: holding.start_date,
        },
      });
    }
  }

  if (tx.holding_id === null && tx.id) {
    await db.investmentTransaction.update({
      where: { id: tx.id },
      data: { holding_id: null },
    });
  }

  await updateContributedAmount(db, account.id, tx.transaction_date.getFullYear());
}

export async function reverseTransactionEffects(
  db: TxClient,
  account: Account,
  tx: InvestmentTransaction,
): Promise<void> {
  const amount = toDecimal(tx.amount);
  const fee = toDecimal(tx.fee);
  let cashBalance = toDecimal(account.cash_balance);

  switch (tx.type) {
    case "buy":
      cashBalance = cashBalance.plus(amount).plus(fee);
      break;
    case "sell":
      cashBalance = cashBalance.minus(amount).plus(fee);
      break;
    case "deposit":
      cashBalance = cashBalance.minus(amount);
      break;
    case "withdraw":
    case "fee":
      cashBalance = cashBalance.plus(amount);
      break;
    case "dividend":
    case "interest": {
      const holding = tx.holding_id
        ? await db.holding.findUnique({ where: { id: tx.holding_id } })
        : null;
      if (holding && isDepositHolding(holding) && tx.type === "interest") {
        applySell(holding, amount);
        await db.holding.update({
          where: { id: holding.id },
          data: { quantity: holding.quantity },
        });
      } else {
        cashBalance = cashBalance.minus(amount);
      }
      break;
    }
  }

  await db.account.update({
    where: { id: account.id },
    data: { cash_balance: cashBalance },
  });
}
