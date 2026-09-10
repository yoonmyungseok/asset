import type { Card, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  applyLedgerBalanceEffects,
  getInternalTransferCategory,
  getReimbursementInCategory,
  getReimbursementOutCategory,
  isBankTransferMethod,
  reverseLedgerBalanceEffects,
  validateAccountForTransfer,
  type LedgerTxWithRelations,
} from "@/lib/services/bank-transfers";
import {
  resolveAccountIdForCard,
  validateCardForExpense,
} from "@/lib/services/card-payments";
import { getOrCreateTag } from "@/lib/services/core";
import { LEDGER_TX_INCLUDE } from "@/lib/api/serializers";
import type { z } from "zod";
import type {
  ledgerTransactionCreateSchema,
  ledgerTransactionUpdateSchema,
} from "@/lib/validations/ledger";

type LedgerCreate = z.infer<typeof ledgerTransactionCreateSchema>;
type LedgerUpdate = z.infer<typeof ledgerTransactionUpdateSchema>;
type TxClient = Prisma.TransactionClient;

type ResolvedCreatePayload = {
  type: string;
  category_id: number;
  account_id: number | null;
  to_account_id: number | null;
  card_id: number | null;
};

async function validateCardPaymentMethod(
  tx: TxClient,
  paymentMethodId: number | null | undefined,
  cardId: number | null | undefined,
): Promise<Card | null> {
  if (!cardId) {
    return null;
  }
  const card = await validateCardForExpense(tx, cardId);
  if (paymentMethodId) {
    const method = await tx.paymentMethod.findUnique({ where: { id: paymentMethodId } });
    if (method?.name === "카드") {
      return card;
    }
  }
  return card;
}

export async function resolveCreatePayload(
  tx: TxClient,
  payload: LedgerCreate,
): Promise<ResolvedCreatePayload> {
  const method = payload.payment_method_id
    ? await tx.paymentMethod.findUnique({ where: { id: payload.payment_method_id } })
    : null;
  const methodName = method?.name ?? null;
  const card = await validateCardPaymentMethod(tx, payload.payment_method_id, payload.card_id);

  if (method?.name === "카드" && !card) {
    throw new ServiceError(400, "카드 결제 시 카드를 선택해 주세요.");
  }

  if (payload.type === "income") {
    if (!payload.category_id) {
      throw new ServiceError(400, "카테고리를 선택해 주세요.");
    }
    const category = await tx.category.findUnique({ where: { id: payload.category_id } });
    if (!category) {
      throw new ServiceError(404, "카테고리를 찾을 수 없습니다.");
    }
    if (!payload.account_id) {
      throw new ServiceError(400, "입금 계좌를 선택해 주세요.");
    }
    await validateAccountForTransfer(tx, payload.account_id);
    return {
      type: "income",
      category_id: category.id,
      account_id: payload.account_id,
      to_account_id: null,
      card_id: null,
    };
  }

  if (payload.type === "reimbursement_out") {
    if (!payload.account_id) {
      throw new ServiceError(400, "출금 계좌를 선택해 주세요.");
    }
    await validateAccountForTransfer(tx, payload.account_id);
    const category = await getReimbursementOutCategory(tx);
    return {
      type: "reimbursement_out",
      category_id: category.id,
      account_id: payload.account_id,
      to_account_id: null,
      card_id: null,
    };
  }

  if (payload.type === "reimbursement_in") {
    if (!payload.account_id) {
      throw new ServiceError(400, "입금 계좌를 선택해 주세요.");
    }
    await validateAccountForTransfer(tx, payload.account_id);
    const category = await getReimbursementInCategory(tx);
    return {
      type: "reimbursement_in",
      category_id: category.id,
      account_id: payload.account_id,
      to_account_id: null,
      card_id: null,
    };
  }

  if (isBankTransferMethod(methodName)) {
    if (!payload.account_id) {
      throw new ServiceError(400, "계좌이체 시 출금 계좌를 선택해 주세요.");
    }
    if (payload.to_account_id) {
      if (payload.type !== "transfer" && payload.type !== "expense") {
        throw new ServiceError(400, "내부 이체는 transfer 유형으로 등록해야 합니다.");
      }
      const category = await getInternalTransferCategory(tx);
      return {
        type: "transfer",
        category_id: category.id,
        account_id: payload.account_id,
        to_account_id: payload.to_account_id,
        card_id: null,
      };
    }
    if (payload.type !== "expense") {
      throw new ServiceError(400, "외부 계좌이체는 지출로 등록해야 합니다.");
    }
    if (!payload.category_id) {
      throw new ServiceError(400, "카테고리를 선택해 주세요.");
    }
    const category = await tx.category.findUnique({ where: { id: payload.category_id } });
    if (!category) {
      throw new ServiceError(404, "카테고리를 찾을 수 없습니다.");
    }
    return {
      type: "expense",
      category_id: category.id,
      account_id: payload.account_id,
      to_account_id: null,
      card_id: null,
    };
  }

  if (!payload.category_id) {
    throw new ServiceError(400, "카테고리를 선택해 주세요.");
  }
  const category = await tx.category.findUnique({ where: { id: payload.category_id } });
  if (!category) {
    throw new ServiceError(404, "카테고리를 찾을 수 없습니다.");
  }

  const accountId = payload.account_id ?? resolveAccountIdForCard(card);
  return {
    type: payload.type,
    category_id: category.id,
    account_id: accountId,
    to_account_id: null,
    card_id: card?.id ?? null,
  };
}

async function syncLedgerTags(tx: TxClient, txId: number, tagNames: string[]): Promise<void> {
  await tx.ledgerTransactionTag.deleteMany({ where: { ledger_transaction_id: txId } });
  for (const name of tagNames) {
    const tag = await getOrCreateTag(tx, name);
    await tx.ledgerTransactionTag.create({
      data: { ledger_transaction_id: txId, tag_id: tag.id },
    });
  }
}

export async function createLedgerTransaction(payload: LedgerCreate) {
  return prisma.$transaction(async (tx) => {
    const resolved = await resolveCreatePayload(tx, payload);
    const created = await tx.ledgerTransaction.create({
      data: {
        transaction_date: payload.transaction_date,
        type: resolved.type,
        amount: payload.amount,
        category_id: resolved.category_id,
        payment_method_id:
          resolved.type === "income" ||
          resolved.type === "reimbursement_out" ||
          resolved.type === "reimbursement_in"
            ? null
            : payload.payment_method_id,
        account_id: resolved.account_id,
        to_account_id: resolved.to_account_id,
        card_id: resolved.card_id,
        merchant: payload.merchant ?? null,
        memo: payload.memo ?? null,
        is_fixed: payload.is_fixed,
      },
    });

    if (payload.tag_names.length > 0) {
      await syncLedgerTags(tx, created.id, payload.tag_names);
    }

    const ledgerTx = await tx.ledgerTransaction.findUniqueOrThrow({
      where: { id: created.id },
      include: LEDGER_TX_INCLUDE,
    });

    await applyLedgerBalanceEffects(tx, ledgerTx as LedgerTxWithRelations);

    return tx.ledgerTransaction.findUniqueOrThrow({
      where: { id: created.id },
      include: LEDGER_TX_INCLUDE,
    });
  });
}

export async function updateLedgerTransaction(transactionId: number, payload: LedgerUpdate) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.ledgerTransaction.findUnique({
      where: { id: transactionId },
      include: LEDGER_TX_INCLUDE,
    });
    if (!existing) {
      throw new ServiceError(404, "거래를 찾을 수 없습니다.");
    }

    await reverseLedgerBalanceEffects(tx, existing as LedgerTxWithRelations);

    const { tag_names: tagNames, ...data } = payload;

    const newPaymentMethodId =
      data.payment_method_id !== undefined ? data.payment_method_id : existing.payment_method_id;
    const method = newPaymentMethodId
      ? await tx.paymentMethod.findUnique({ where: { id: newPaymentMethodId } })
      : null;
    const newCardId = data.card_id !== undefined ? data.card_id : existing.card_id;
    const card =
      method?.name === "카드"
        ? await validateCardPaymentMethod(tx, newPaymentMethodId, newCardId)
        : null;

    if (method?.name === "카드" && !card) {
      throw new ServiceError(400, "카드 결제 시 카드를 선택해 주세요.");
    }

    await tx.ledgerTransaction.update({
      where: { id: transactionId },
      data: data as Prisma.LedgerTransactionUncheckedUpdateInput,
    });

    if (tagNames != null) {
      await syncLedgerTags(tx, transactionId, tagNames);
    }

    let ledgerTx = await tx.ledgerTransaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: LEDGER_TX_INCLUDE,
    });

    if (method?.name === "카드" && card) {
      await tx.ledgerTransaction.update({
        where: { id: transactionId },
        data: {
          card_id: card.id,
          account_id: data.account_id ?? ledgerTx.account_id ?? resolveAccountIdForCard(card),
          to_account_id: null,
        },
      });
    } else if (method && method.name !== "카드") {
      if (!isBankTransferMethod(method.name)) {
        await tx.ledgerTransaction.update({
          where: { id: transactionId },
          data: { card_id: null },
        });
      } else if (!ledgerTx.to_account_id) {
        await tx.ledgerTransaction.update({
          where: { id: transactionId },
          data: { card_id: null },
        });
      }
    }

    ledgerTx = await tx.ledgerTransaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: LEDGER_TX_INCLUDE,
    });

    if (ledgerTx.type === "transfer") {
      const category = await getInternalTransferCategory(tx);
      await tx.ledgerTransaction.update({
        where: { id: transactionId },
        data: { category_id: category.id },
      });
    } else if (ledgerTx.type === "income") {
      if (!ledgerTx.account_id) {
        throw new ServiceError(400, "입금 계좌를 선택해 주세요.");
      }
      await validateAccountForTransfer(tx, ledgerTx.account_id);
      await tx.ledgerTransaction.update({
        where: { id: transactionId },
        data: { payment_method_id: null, card_id: null, to_account_id: null },
      });
    } else if (ledgerTx.type === "reimbursement_out") {
      const category = await getReimbursementOutCategory(tx);
      if (!ledgerTx.account_id) {
        throw new ServiceError(400, "출금 계좌를 선택해 주세요.");
      }
      await validateAccountForTransfer(tx, ledgerTx.account_id);
      await tx.ledgerTransaction.update({
        where: { id: transactionId },
        data: { payment_method_id: null, card_id: null, to_account_id: null, category_id: category.id },
      });
    } else if (ledgerTx.type === "reimbursement_in") {
      const category = await getReimbursementInCategory(tx);
      if (!ledgerTx.account_id) {
        throw new ServiceError(400, "입금 계좌를 선택해 주세요.");
      }
      await validateAccountForTransfer(tx, ledgerTx.account_id);
      await tx.ledgerTransaction.update({
        where: { id: transactionId },
        data: { payment_method_id: null, card_id: null, to_account_id: null, category_id: category.id },
      });
    }

    ledgerTx = await tx.ledgerTransaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: LEDGER_TX_INCLUDE,
    });

    await applyLedgerBalanceEffects(tx, ledgerTx as LedgerTxWithRelations);

    return tx.ledgerTransaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: LEDGER_TX_INCLUDE,
    });
  });
}

export async function deleteLedgerTransaction(transactionId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.ledgerTransaction.findUnique({
      where: { id: transactionId },
      include: { payment_method: true, card: true },
    });
    if (!existing) {
      throw new ServiceError(404, "거래를 찾을 수 없습니다.");
    }
    await reverseLedgerBalanceEffects(tx, existing as LedgerTxWithRelations);
    await tx.ledgerTransaction.delete({ where: { id: transactionId } });
  });
}
