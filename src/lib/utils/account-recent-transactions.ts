import type Decimal from 'decimal.js';
import { toDecimal } from '@/lib/decimal';
import type { InvestmentTransaction, LedgerTransaction } from '@/types/api';
import { INVESTMENT_TX_TYPES, LEDGER_TX_TYPES } from '@/lib/utils/format';

export type AccountRecentTransaction =
  | { source: 'investment'; data: InvestmentTransaction }
  | { source: 'ledger'; data: LedgerTransaction };

export type AccountRecentTransactionWithBalance = AccountRecentTransaction & {
  balanceAfter: string;
};

export function mergeAccountRecentTransactions(
  investmentTransactions: InvestmentTransaction[],
  ledgerTransactions: LedgerTransaction[],
  limit = 20,
): AccountRecentTransaction[] {
  const merged: AccountRecentTransaction[] = [
    ...investmentTransactions.map((data) => ({ source: 'investment' as const, data })),
    ...ledgerTransactions.map((data) => ({ source: 'ledger' as const, data })),
  ];

  merged.sort((a, b) => {
    const dateCompare = b.data.transaction_date.localeCompare(a.data.transaction_date);
    if (dateCompare !== 0) return dateCompare;
    return b.data.id - a.data.id;
  });

  return merged.slice(0, limit);
}

export function recentTransactionKey(item: AccountRecentTransaction): string {
  return `${item.source}-${item.data.id}`;
}

export function recentTransactionTypeLabel(item: AccountRecentTransaction): string {
  if (item.source === 'investment') {
    return INVESTMENT_TX_TYPES[item.data.type] || item.data.type;
  }
  return LEDGER_TX_TYPES[item.data.type] || item.data.type;
}

export function recentTransactionDetailLabel(
  item: AccountRecentTransaction,
  accountId: number,
): string {
  if (item.source === 'investment') {
    const tx = item.data;
    if (tx.holding_name) {
      if (tx.holding_symbol && !tx.holding_symbol.startsWith('DEP.')) {
        return `${tx.holding_name} (${tx.holding_symbol})`;
      }
      return tx.holding_name;
    }
    return tx.memo || '-';
  }

  const tx = item.data;
  if (tx.type === 'transfer') {
    if (tx.account_id === accountId && tx.to_account_name) {
      return `→ ${tx.to_account_name}`;
    }
    if (tx.to_account_id === accountId && tx.account_name) {
      return `← ${tx.account_name}`;
    }
    if (tx.account_name && tx.to_account_name) {
      return `${tx.account_name} → ${tx.to_account_name}`;
    }
    return tx.category.name;
  }

  if (tx.type === 'reimbursement_out' || tx.type === 'reimbursement_in') {
    return tx.merchant || tx.memo || tx.category.name;
  }

  if (tx.category.parent_name) {
    return `${tx.category.parent_name} › ${tx.category.name}`;
  }
  return tx.category.name;
}

export function recentTransactionMemo(item: AccountRecentTransaction): string {
  if (item.source === 'investment') {
    return item.data.memo || '';
  }

  const tx = item.data;
  if (tx.type === 'transfer') {
    return tx.memo || '가계부';
  }
  return tx.merchant || tx.memo || '가계부';
}

export function recentTransactionCashDelta(
  item: AccountRecentTransaction,
  accountId: number,
): Decimal {
  if (item.source === 'investment') {
    const tx = item.data;
    const amount = toDecimal(tx.amount);
    const fee = toDecimal(tx.fee);
    const tax = toDecimal(tx.tax);

    switch (tx.type) {
      case 'buy':
        return amount.plus(fee).negated();
      case 'sell':
        return amount.minus(fee).minus(tax);
      case 'deposit':
      case 'dividend':
        return amount;
      case 'withdraw':
      case 'fee':
        return amount.negated();
      case 'interest':
        // 예금 보유 종목의 이자는 원금에 합산되므로 예수금 잔고를 변경하지 않는다.
        return tx.holding_id != null ? toDecimal(0) : amount;
      default:
        return toDecimal(0);
    }
  }

  const tx = item.data;
  const amount = toDecimal(tx.amount);

  switch (tx.type) {
    case 'income':
    case 'reimbursement_in':
      return tx.account_id === accountId ? amount : toDecimal(0);
    case 'reimbursement_out':
      return tx.account_id === accountId ? amount.negated() : toDecimal(0);
    case 'transfer':
      if (tx.account_id === accountId && tx.to_account_id != null && tx.to_account_id !== accountId) {
        return amount.negated();
      }
      if (tx.to_account_id === accountId && tx.account_id !== accountId) {
        return amount;
      }
      return toDecimal(0);
    case 'expense':
      if (tx.card?.card_type === 'credit') {
        return toDecimal(0);
      }
      if (tx.card?.card_type === 'debit') {
        return tx.account_id === accountId ? amount.negated() : toDecimal(0);
      }
      if (tx.payment_method?.name === '계좌이체' && tx.account_id === accountId && !tx.to_account_id) {
        return amount.negated();
      }
      return toDecimal(0);
    default:
      return toDecimal(0);
  }
}

/**
 * 최신순으로 정렬된 거래 목록에 현재 잔고를 기준으로 역산한 거래 직후 잔액(`balanceAfter`)을 부여한다.
 */
export function attachRecentTransactionBalances(
  transactions: AccountRecentTransaction[],
  currentCashBalance: string | number | null | undefined,
  accountId: number,
): AccountRecentTransactionWithBalance[] {
  let runningBalance = toDecimal(currentCashBalance ?? 0);

  return transactions.map((item) => {
    const balanceAfter = runningBalance.toFixed();
    runningBalance = runningBalance.minus(recentTransactionCashDelta(item, accountId));
    return { ...item, balanceAfter };
  });
}
