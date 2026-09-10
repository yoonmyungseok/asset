import type { Card, Category, PaymentMethod, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { prisma } from "@/lib/db";
import { toDecimal } from "@/lib/decimal";
import { ServiceError } from "@/lib/service-error";

type TxClient = Prisma.TransactionClient;

export async function getCardPaymentCategory(tx?: TxClient): Promise<Category> {
  const run = async (client: TxClient) => {
    const category = await client.category.findFirst({
      where: {
        name: "카드대금",
        type: "expense",
        is_active: true,
      },
    });
    if (!category) {
      throw new ServiceError(500, "카드대금 카테고리가 없습니다. 초기 설정을 실행해 주세요.");
    }
    return category;
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

export async function getCardPaymentMethod(tx?: TxClient): Promise<PaymentMethod> {
  const run = async (client: TxClient) => {
    const method = await client.paymentMethod.findFirst({
      where: { name: "카드" },
    });
    if (!method) {
      throw new ServiceError(500, "카드 결제수단이 없습니다. 초기 설정을 실행해 주세요.");
    }
    return method;
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

export async function validateCardForExpense(tx: TxClient, cardId: number): Promise<Card> {
  const card = await tx.card.findUnique({ where: { id: cardId } });
  if (!card || !card.is_active) {
    throw new ServiceError(404, "카드를 찾을 수 없습니다.");
  }
  if (card.card_type === "debit") {
    if (!card.linked_account_id) {
      throw new ServiceError(400, "체크카드에 연결된 계좌가 없습니다.");
    }
    const account = await tx.account.findUnique({ where: { id: card.linked_account_id } });
    if (!account || !account.is_active) {
      throw new ServiceError(400, "체크카드에 연결된 계좌를 찾을 수 없습니다.");
    }
  } else if (card.card_type === "credit") {
    if (!card.linked_liability_id) {
      throw new ServiceError(400, "신용카드에 연결된 부채가 없습니다.");
    }
    const liability = await tx.liability.findUnique({ where: { id: card.linked_liability_id } });
    if (!liability || !liability.is_active) {
      throw new ServiceError(400, "신용카드에 연결된 부채를 찾을 수 없습니다.");
    }
  } else {
    throw new ServiceError(400, "지원하지 않는 카드 유형입니다.");
  }
  return card;
}

export async function applyCardExpense(
  tx: TxClient,
  card: Card,
  amount: Decimal.Value,
): Promise<number | null> {
  const expenseAmount = toDecimal(amount);
  if (card.card_type === "debit") {
    const account = await tx.account.findUnique({ where: { id: card.linked_account_id! } });
    if (!account) {
      throw new ServiceError(400, "체크카드에 연결된 계좌를 찾을 수 없습니다.");
    }
    await tx.account.update({
      where: { id: account.id },
      data: { cash_balance: toDecimal(account.cash_balance).minus(expenseAmount) },
    });
    return card.linked_account_id;
  }

  const liability = await tx.liability.findUnique({ where: { id: card.linked_liability_id! } });
  if (!liability) {
    throw new ServiceError(400, "신용카드에 연결된 부채를 찾을 수 없습니다.");
  }
  await tx.liability.update({
    where: { id: liability.id },
    data: { current_balance: toDecimal(liability.current_balance).plus(expenseAmount) },
  });
  await tx.liabilityTransaction.create({
    data: {
      liability_id: liability.id,
      transaction_date: new Date(),
      type: "charge",
      amount: expenseAmount,
      memo: "카드 지출",
    },
  });
  return null;
}

export async function reverseCardExpense(
  tx: TxClient,
  card: Card,
  amount: Decimal.Value,
): Promise<void> {
  const expenseAmount = toDecimal(amount);
  if (card.card_type === "debit") {
    const account = await tx.account.findUnique({ where: { id: card.linked_account_id! } });
    if (!account) {
      return;
    }
    await tx.account.update({
      where: { id: account.id },
      data: { cash_balance: toDecimal(account.cash_balance).plus(expenseAmount) },
    });
    return;
  }

  const liability = await tx.liability.findUnique({ where: { id: card.linked_liability_id! } });
  if (!liability) {
    return;
  }
  await tx.liability.update({
    where: { id: liability.id },
    data: { current_balance: toDecimal(liability.current_balance).minus(expenseAmount) },
  });
  await tx.liabilityTransaction.create({
    data: {
      liability_id: liability.id,
      transaction_date: new Date(),
      type: "payment",
      amount: expenseAmount,
      memo: "카드 지출 취소",
    },
  });
}

export function resolveAccountIdForCard(card: Card | null): number | null {
  if (!card) {
    return null;
  }
  if (card.card_type === "debit") {
    return card.linked_account_id;
  }
  return null;
}

export async function processDueCardPayments(asOf?: Date) {
  const today = asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const processed: Awaited<ReturnType<typeof tx.cardSettlement.create>>[] = [];

    const cards = await tx.card.findMany({
      where: {
        card_type: "credit",
        is_active: true,
        due_day: { not: null },
        settlement_account_id: { not: null },
        linked_liability_id: { not: null },
      },
    });

    for (const card of cards) {
      if (!card.due_day || today.getDate() < card.due_day) {
        continue;
      }

      const existing = await tx.cardSettlement.findFirst({
        where: {
          card_id: card.id,
          year: today.getFullYear(),
          month: today.getMonth() + 1,
        },
      });
      if (existing) {
        continue;
      }

      const liability = await tx.liability.findUnique({ where: { id: card.linked_liability_id! } });
      const account = await tx.account.findUnique({ where: { id: card.settlement_account_id! } });
      if (!liability || !account) {
        continue;
      }

      const amount = toDecimal(liability.current_balance);
      if (amount.lte(0)) {
        continue;
      }
      if (toDecimal(account.cash_balance).lt(amount)) {
        continue;
      }

      await tx.account.update({
        where: { id: account.id },
        data: { cash_balance: toDecimal(account.cash_balance).minus(amount) },
      });
      await tx.liability.update({
        where: { id: liability.id },
        data: { current_balance: toDecimal(liability.current_balance).minus(amount) },
      });

      await tx.liabilityTransaction.create({
        data: {
          liability_id: liability.id,
          transaction_date: today,
          type: "payment",
          amount,
          memo: `${card.name} 자동 결제`,
        },
      });

      const category = await getCardPaymentCategory(tx);
      const paymentMethod = await getCardPaymentMethod(tx);
      await tx.ledgerTransaction.create({
        data: {
          transaction_date: today,
          type: "expense",
          amount,
          category_id: category.id,
          payment_method_id: paymentMethod.id,
          account_id: card.settlement_account_id,
          card_id: card.id,
          merchant: card.name,
          memo: `${card.name} 카드대금 자동 결제`,
          is_fixed: true,
        },
      });

      const settlement = await tx.cardSettlement.create({
        data: {
          card_id: card.id,
          year: today.getFullYear(),
          month: today.getMonth() + 1,
          amount,
          settlement_date: today,
        },
      });
      processed.push(settlement);
    }

    return processed;
  });
}

export async function validateCheckingAccount(tx: TxClient, accountId: number) {
  const account = await tx.account.findFirst({
    where: {
      id: accountId,
      is_active: true,
      account_type: { code: "CHECKING" },
    },
  });
  if (!account) {
    throw new ServiceError(400, "입출금 계좌만 연결할 수 있습니다.");
  }
  return account;
}
