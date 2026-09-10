import type { Card, Category, LedgerTransaction, PaymentMethod, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { prisma } from "@/lib/db";
import { toDecimal } from "@/lib/decimal";
import { ServiceError } from "@/lib/service-error";
import {
  applyCardExpense,
  reverseCardExpense,
} from "@/lib/services/card-payments";

export const INTERNAL_TRANSFER_CATEGORY_NAME = "내부이체";
export const REIMBURSEMENT_OUT_CATEGORY_NAME = "반환예정";
export const REIMBURSEMENT_IN_CATEGORY_NAME = "반환입금";

type TxClient = Prisma.TransactionClient;

export type LedgerTxWithRelations = LedgerTransaction & {
  payment_method?: PaymentMethod | null;
  card?: Card | null;
};

export async function getInternalTransferCategory(tx?: TxClient): Promise<Category> {
  const run = async (client: TxClient) => {
    const existing = await client.category.findFirst({
      where: {
        name: INTERNAL_TRANSFER_CATEGORY_NAME,
        parent_id: null,
        is_active: true,
      },
    });
    if (existing) {
      return existing;
    }
    return client.category.create({
      data: {
        name: INTERNAL_TRANSFER_CATEGORY_NAME,
        type: "expense",
        parent_id: null,
        is_system: true,
        sort_order: 999,
        is_active: true,
      },
    });
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

export async function getReimbursementOutCategory(tx?: TxClient): Promise<Category> {
  const run = async (client: TxClient) => {
    const existing = await client.category.findFirst({
      where: {
        name: REIMBURSEMENT_OUT_CATEGORY_NAME,
        parent_id: null,
        is_active: true,
      },
    });
    if (existing) {
      return existing;
    }
    return client.category.create({
      data: {
        name: REIMBURSEMENT_OUT_CATEGORY_NAME,
        type: "expense",
        parent_id: null,
        is_system: true,
        sort_order: 998,
        is_active: true,
      },
    });
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

export async function getReimbursementInCategory(tx?: TxClient): Promise<Category> {
  const run = async (client: TxClient) => {
    const existing = await client.category.findFirst({
      where: {
        name: REIMBURSEMENT_IN_CATEGORY_NAME,
        parent_id: null,
        is_active: true,
      },
    });
    if (existing) {
      return existing;
    }
    return client.category.create({
      data: {
        name: REIMBURSEMENT_IN_CATEGORY_NAME,
        type: "income",
        parent_id: null,
        is_system: true,
        sort_order: 998,
        is_active: true,
      },
    });
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

export async function validateAccountForTransfer(tx: TxClient, accountId: number) {
  const account = await tx.account.findUnique({ where: { id: accountId } });
  if (!account || !account.is_active) {
    throw new ServiceError(400, "유효하지 않은 계좌입니다.");
  }
  return account;
}

export async function applyInternalTransfer(
  tx: TxClient,
  fromAccountId: number,
  toAccountId: number,
  amount: Decimal.Value,
): Promise<void> {
  if (fromAccountId === toAccountId) {
    throw new ServiceError(400, "출금·입금 계좌가 같을 수 없습니다.");
  }
  const transferAmount = toDecimal(amount);
  const fromAccount = await validateAccountForTransfer(tx, fromAccountId);
  const toAccount = await validateAccountForTransfer(tx, toAccountId);
  await tx.account.update({
    where: { id: fromAccount.id },
    data: { cash_balance: toDecimal(fromAccount.cash_balance).minus(transferAmount) },
  });
  await tx.account.update({
    where: { id: toAccount.id },
    data: { cash_balance: toDecimal(toAccount.cash_balance).plus(transferAmount) },
  });
}

export async function reverseInternalTransfer(
  tx: TxClient,
  fromAccountId: number,
  toAccountId: number,
  amount: Decimal.Value,
): Promise<void> {
  const transferAmount = toDecimal(amount);
  const fromAccount = await tx.account.findUnique({ where: { id: fromAccountId } });
  const toAccount = await tx.account.findUnique({ where: { id: toAccountId } });
  if (fromAccount) {
    await tx.account.update({
      where: { id: fromAccount.id },
      data: { cash_balance: toDecimal(fromAccount.cash_balance).plus(transferAmount) },
    });
  }
  if (toAccount) {
    await tx.account.update({
      where: { id: toAccount.id },
      data: { cash_balance: toDecimal(toAccount.cash_balance).minus(transferAmount) },
    });
  }
}

export async function applyExternalTransfer(
  tx: TxClient,
  fromAccountId: number,
  amount: Decimal.Value,
): Promise<void> {
  const transferAmount = toDecimal(amount);
  const account = await validateAccountForTransfer(tx, fromAccountId);
  await tx.account.update({
    where: { id: account.id },
    data: { cash_balance: toDecimal(account.cash_balance).minus(transferAmount) },
  });
}

export async function reverseExternalTransfer(
  tx: TxClient,
  fromAccountId: number,
  amount: Decimal.Value,
): Promise<void> {
  const transferAmount = toDecimal(amount);
  const account = await tx.account.findUnique({ where: { id: fromAccountId } });
  if (account) {
    await tx.account.update({
      where: { id: account.id },
      data: { cash_balance: toDecimal(account.cash_balance).plus(transferAmount) },
    });
  }
}

export async function applyIncomeDeposit(
  tx: TxClient,
  accountId: number,
  amount: Decimal.Value,
): Promise<void> {
  const depositAmount = toDecimal(amount);
  const account = await validateAccountForTransfer(tx, accountId);
  await tx.account.update({
    where: { id: account.id },
    data: { cash_balance: toDecimal(account.cash_balance).plus(depositAmount) },
  });
}

export async function reverseIncomeDeposit(
  tx: TxClient,
  accountId: number,
  amount: Decimal.Value,
): Promise<void> {
  const depositAmount = toDecimal(amount);
  const account = await tx.account.findUnique({ where: { id: accountId } });
  if (account) {
    await tx.account.update({
      where: { id: account.id },
      data: { cash_balance: toDecimal(account.cash_balance).minus(depositAmount) },
    });
  }
}

export function isBankTransferMethod(methodName: string | null | undefined): boolean {
  return methodName === "계좌이체";
}

export async function reverseLedgerBalanceEffects(tx: TxClient, ledgerTx: LedgerTxWithRelations): Promise<void> {
  const methodName = ledgerTx.payment_method?.name ?? null;
  if (ledgerTx.type === "transfer" && ledgerTx.account_id && ledgerTx.to_account_id) {
    await reverseInternalTransfer(tx, ledgerTx.account_id, ledgerTx.to_account_id, ledgerTx.amount);
  } else if (
    ledgerTx.type === "expense" &&
    isBankTransferMethod(methodName) &&
    ledgerTx.account_id &&
    !ledgerTx.to_account_id
  ) {
    await reverseExternalTransfer(tx, ledgerTx.account_id, ledgerTx.amount);
  } else if (ledgerTx.type === "expense" && ledgerTx.card) {
    await reverseCardExpense(tx, ledgerTx.card, ledgerTx.amount);
  } else if (ledgerTx.type === "income" && ledgerTx.account_id) {
    await reverseIncomeDeposit(tx, ledgerTx.account_id, ledgerTx.amount);
  } else if (ledgerTx.type === "reimbursement_out" && ledgerTx.account_id) {
    await reverseExternalTransfer(tx, ledgerTx.account_id, ledgerTx.amount);
  } else if (ledgerTx.type === "reimbursement_in" && ledgerTx.account_id) {
    await reverseIncomeDeposit(tx, ledgerTx.account_id, ledgerTx.amount);
  }
}

export async function applyLedgerBalanceEffects(tx: TxClient, ledgerTx: LedgerTxWithRelations): Promise<void> {
  const methodName = ledgerTx.payment_method?.name ?? null;
  if (ledgerTx.type === "transfer" && ledgerTx.account_id && ledgerTx.to_account_id) {
    await applyInternalTransfer(tx, ledgerTx.account_id, ledgerTx.to_account_id, ledgerTx.amount);
  } else if (
    ledgerTx.type === "expense" &&
    isBankTransferMethod(methodName) &&
    ledgerTx.account_id &&
    !ledgerTx.to_account_id
  ) {
    await applyExternalTransfer(tx, ledgerTx.account_id, ledgerTx.amount);
  } else if (ledgerTx.type === "expense" && ledgerTx.card) {
    await applyCardExpense(tx, ledgerTx.card, ledgerTx.amount);
  } else if (ledgerTx.type === "income" && ledgerTx.account_id) {
    await applyIncomeDeposit(tx, ledgerTx.account_id, ledgerTx.amount);
  } else if (ledgerTx.type === "reimbursement_out" && ledgerTx.account_id) {
    await applyExternalTransfer(tx, ledgerTx.account_id, ledgerTx.amount);
  } else if (ledgerTx.type === "reimbursement_in" && ledgerTx.account_id) {
    await applyIncomeDeposit(tx, ledgerTx.account_id, ledgerTx.amount);
  }
}

export async function withLedgerBalanceTransaction<T>(
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}
