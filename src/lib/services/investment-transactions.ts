import type { Account, AccountType, Holding, InvestmentTransaction, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import type { z } from "zod";

import { toDecimal } from "@/lib/decimal";
import { ServiceError } from "@/lib/service-error";
import {
  applyBuy,
  applySell,
  updateContributedAmount,
} from "@/lib/services/core";
import {
  adjustBookCostOnBuy,
  adjustBookCostOnSell,
  ASSET_CLASS_DEPOSIT,
  generateDepositSymbol,
  holdingMarketValue,
  holdingCostBasis,
  isDepositHolding,
  normalizeDepositHolding,
  restoreBookCostOnSellReversal,
} from "@/lib/utils";
import type {
  investmentTransactionCreateSchema,
  investmentTransactionUpdateSchema,
} from "@/lib/validations/account";
import { prisma } from "@/lib/db";

type TxClient = Prisma.TransactionClient;
type InvestmentCreate = z.infer<typeof investmentTransactionCreateSchema>;
type InvestmentUpdate = z.infer<typeof investmentTransactionUpdateSchema>;

type AccountWithType = Account & { account_type: AccountType };

export function assertTransactionAllowedForAccount(
  account: AccountWithType,
  type: string,
): void {
  const { category, supports_holdings } = account.account_type;

  // 거래소의 첫 버전은 원화 매매와 잔고 조정만 지원한다.
  if (account.account_type.code === "CRYPTO_EXCHANGE" && !["buy", "sell", "deposit", "withdraw", "fee"].includes(type)) {
    throw new ServiceError(400, "거래소 계좌에서는 원화 매매와 잔고 조정만 지원합니다.");
  }

  if (type === "buy" || type === "sell") {
    if (!supports_holdings) {
      throw new ServiceError(400, "이 계좌 유형은 매수·매도를 지원하지 않습니다.");
    }
    return;
  }

  if (type === "dividend") {
    if (!supports_holdings) {
      throw new ServiceError(400, "이 계좌 유형은 배당을 지원하지 않습니다.");
    }
    return;
  }

  if (type === "interest") {
    if (category !== "deposit" && !supports_holdings) {
      throw new ServiceError(
        400,
        "이자는 예적금 또는 보유 상품이 있는 계좌에서만 등록할 수 있습니다.",
      );
    }
    return;
  }
}

export async function resolveHolding(
  db: TxClient,
  account: Account,
  payload: InvestmentCreate,
): Promise<Holding> {
  const accountType = await db.accountType.findUniqueOrThrow({ where: { id: account.account_type_id } });
  const isCrypto = accountType.code === "CRYPTO_EXCHANGE";
  if (payload.holding_id) {
    const holding = await db.holding.findUnique({ where: { id: payload.holding_id } });
    if (!holding || holding.account_id !== account.id) {
      throw new ServiceError(400, "유효하지 않은 보유 종목입니다.");
    }
    if (isCrypto !== (holding.asset_class === "crypto")) throw new ServiceError(400, "계좌와 자산 유형이 일치하지 않습니다.");
    return holding;
  }

  const assetClass = isCrypto ? "crypto" : (payload.asset_class ?? "stock");
  if (!isCrypto && assetClass === "crypto") throw new ServiceError(400, "암호화폐는 거래소 계좌에 등록해 주세요.");

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
  const symbol = isCrypto ? payload.symbol.trim().toUpperCase() : payload.symbol;
  if (isCrypto && !/^[A-Z0-9]{1,20}$/.test(symbol)) throw new ServiceError(400, "코인 심볼을 확인해 주세요.");

  let holding = await db.holding.findFirst({
    where: { account_id: account.id, symbol },
  });
  if (!holding) {
    holding = await db.holding.create({
      data: {
        account_id: account.id,
        asset_class: assetClass,
        symbol,
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
  const tax = toDecimal(tx.tax);
  let cashBalance = toDecimal(account.cash_balance);
  let depositSellData: { amount: Decimal; quantity: Decimal } | null = null;

  if (holding?.asset_class === "crypto" && (tx.type === "buy" || tx.type === "sell")) {
    const quantity = toDecimal(tx.quantity);
    const price = toDecimal(tx.price);
    if (quantity.lte(0) || price.lte(0) || amount.lte(0) || fee.lt(0) || tax.lt(0)) {
      throw new ServiceError(400, "매매 수량과 단가는 양수, 수수료와 세금은 0 이상이어야 합니다.");
    }
    if (tx.type === "sell" && quantity.gt(toDecimal(holding.quantity))) {
      throw new ServiceError(400, "보유 수량보다 많이 매도할 수 없습니다.");
    }
    if (tx.type === "buy" && amount.plus(fee).gt(cashBalance)) throw new ServiceError(400, "원화 잔액이 부족합니다.");
    if (tx.type === "sell" && fee.plus(tax).gt(amount)) throw new ServiceError(400, "수수료와 세금이 매도 금액보다 큽니다.");
    const later = await db.investmentTransaction.findFirst({ where: { holding_id: holding.id, id: { not: tx.id }, type: { in: ["buy", "sell"] }, transaction_date: { gt: tx.transaction_date } } });
    if (later) throw new ServiceError(400, "코인 거래는 날짜순으로 입력해 주세요.");
    // 수정·삭제 시 직전 상태를 복원하기 위해 원가와 평균단가를 보관한다.
    await db.investmentTransaction.update({ where: { id: tx.id }, data: {
      crypto_cost_before: holdingCostBasis(holding), crypto_avg_before: holding.avg_cost_price,
    } });
  }

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
        const cost = holding.asset_class === "crypto" ? amount.plus(fee) : amount;
        if (holding.asset_class === "crypto" && holding.book_cost == null) holding.book_cost = holdingCostBasis(holding);
        applyBuy(holding, toDecimal(tx.quantity), toDecimal(tx.price), cost);
        adjustBookCostOnBuy(holding, cost);
        if (holding.asset_class === "crypto") {
          // 실제 장부원가를 기준으로 평균 매입단가를 계산한다.
          holding.avg_cost_price = toDecimal(holding.book_cost).div(toDecimal(holding.quantity)).toDecimalPlaces(12, Decimal.ROUND_HALF_UP);
        }
      }
      cashBalance = cashBalance.minus(amount).minus(fee);
      break;
    }
    case "sell": {
      if (!holding) {
        throw new ServiceError(400, "매도 거래에는 보유 종목이 필요합니다.");
      }
      if (isDepositHolding(holding)) {
        const principal = toDecimal(holding.quantity);
        if (principal.lte(0)) {
          throw new ServiceError(400, "해지할 예금 원금이 없습니다.");
        }
        const redemptionAmount = holdingMarketValue(holding, tx.transaction_date);
        applySell(holding, principal);
        cashBalance = cashBalance.plus(redemptionAmount);
        depositSellData = { amount: redemptionAmount, quantity: principal };
        tx.amount = redemptionAmount;
        tx.quantity = principal;
        tx.price = new Decimal(1);
      } else {
        const sellQty = tx.quantity != null ? toDecimal(tx.quantity) : amount;
        const priorQty = toDecimal(holding.quantity);
        adjustBookCostOnSell(holding, sellQty, priorQty);
        applySell(holding, sellQty);
        cashBalance = cashBalance.plus(amount).minus(fee).minus(tax);
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

  if (holding) {
    const exists = await db.holding.findUnique({ where: { id: holding.id } });
    if (exists) {
      await db.holding.update({
        where: { id: holding.id },
        data: {
          quantity: holding.quantity,
          avg_cost_price: holding.avg_cost_price,
          book_cost: holding.book_cost,
          manual_price: holding.manual_price,
          start_date: holding.start_date,
        },
      });
    }
  }

  if (tx.id && depositSellData) {
    await db.investmentTransaction.update({
      where: { id: tx.id },
      data: {
        amount: depositSellData.amount,
        quantity: depositSellData.quantity,
        price: new Decimal(1),
        fee: new Decimal(0),
        tax: new Decimal(0),
      },
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
  const tax = toDecimal(tx.tax);
  let cashBalance = toDecimal(account.cash_balance);

  if (tx.holding_id && (tx.type === "buy" || tx.type === "sell")) {
    const holding = await db.holding.findUnique({ where: { id: tx.holding_id } });
    if (holding?.asset_class === "crypto") {
      // 이후 거래가 있으면 역순으로만 수정·삭제해 원가 이력을 보존한다.
      const later = await db.investmentTransaction.findFirst({ where: { holding_id: holding.id, id: { gt: tx.id }, type: { in: ["buy", "sell"] } } });
      if (later) throw new ServiceError(400, "이 코인의 이후 매매부터 수정하거나 삭제해 주세요.");
      if (tx.crypto_cost_before == null || tx.crypto_avg_before == null) throw new ServiceError(400, "복원할 매매 원가가 없습니다.");
      const qty = toDecimal(tx.quantity);
      const restored = tx.type === "buy" ? toDecimal(holding.quantity).minus(qty) : toDecimal(holding.quantity).plus(qty);
      if (restored.lt(0)) throw new ServiceError(400, "현재 보유 수량으로 거래를 되돌릴 수 없습니다.");
      await db.holding.update({ where: { id: holding.id }, data: { quantity: restored, book_cost: tx.crypto_cost_before, avg_cost_price: tx.crypto_avg_before } });
      cashBalance = tx.type === "buy" ? cashBalance.plus(amount).plus(fee) : cashBalance.minus(amount).plus(fee).plus(tax);
      await db.account.update({ where: { id: account.id }, data: { cash_balance: cashBalance } });
      return;
    }
  }

  switch (tx.type) {
    case "buy": {
      cashBalance = cashBalance.plus(amount).plus(fee);
      const holding = tx.holding_id
        ? await db.holding.findUnique({ where: { id: tx.holding_id } })
        : null;
      if (holding) {
        const sellQty = tx.quantity != null ? toDecimal(tx.quantity) : amount;
        if (!isDepositHolding(holding)) {
          holding.book_cost = toDecimal(holding.book_cost).minus(amount);
          if (toDecimal(holding.book_cost).lt(0)) {
            holding.book_cost = new Decimal(0);
          }
        }
        applySell(holding, sellQty);
        await db.holding.update({
          where: { id: holding.id },
          data: {
            quantity: holding.quantity,
            book_cost: holding.book_cost,
          },
        });
      }
      break;
    }
    case "sell": {
      cashBalance = cashBalance.minus(amount).plus(fee).plus(tax);
      const holding = tx.holding_id
        ? await db.holding.findUnique({ where: { id: tx.holding_id } })
        : null;
      if (holding) {
        const buyQty = tx.quantity != null ? toDecimal(tx.quantity) : amount;
        const buyPrice = tx.price != null ? toDecimal(tx.price) : toDecimal(holding.avg_cost_price);
        if (isDepositHolding(holding)) {
          applyBuy(holding, buyQty, new Decimal(1));
        } else {
          restoreBookCostOnSellReversal(holding, buyQty);
          applyBuy(holding, buyQty, buyPrice, amount);
        }
        await db.holding.update({
          where: { id: holding.id },
          data: {
            quantity: holding.quantity,
            avg_cost_price: holding.avg_cost_price,
            book_cost: holding.book_cost,
          },
        });
      }
      break;
    }
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

export async function updateInvestmentTransaction(
  transactionId: number,
  payload: InvestmentUpdate,
): Promise<InvestmentTransaction> {
  return prisma.$transaction(async (db) => {
    const existing = await db.investmentTransaction.findUnique({ where: { id: transactionId } });
    if (!existing) {
      throw new ServiceError(404, "거래를 찾을 수 없습니다.");
    }

    const account = await db.account.findUnique({
      where: { id: existing.account_id },
      include: { account_type: true },
    });
    if (!account) {
      throw new ServiceError(404, "계좌를 찾을 수 없습니다.");
    }

    const effectiveType = payload.type ?? existing.type;
    assertTransactionAllowedForAccount(account, effectiveType);

    const oldYear = existing.transaction_date.getFullYear();

    await reverseTransactionEffects(db, account, existing);

    const updated = await db.investmentTransaction.update({
      where: { id: transactionId },
      data: payload,
    });

    const holding = updated.holding_id
      ? await db.holding.findUnique({ where: { id: updated.holding_id } })
      : null;

    const refreshedAccount = await db.account.findUniqueOrThrow({ where: { id: account.id } });
    await applyTransactionEffects(db, refreshedAccount, holding, updated);

    const newYear = updated.transaction_date.getFullYear();
    await updateContributedAmount(db, account.id, oldYear);
    if (newYear !== oldYear) {
      await updateContributedAmount(db, account.id, newYear);
    }

    return updated;
  });
}
