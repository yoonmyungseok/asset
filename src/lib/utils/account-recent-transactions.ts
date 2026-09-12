import type { InvestmentTransaction, LedgerTransaction } from '@/types/api';
import { INVESTMENT_TX_TYPES, LEDGER_TX_TYPES } from '@/lib/utils/format';

export type AccountRecentTransaction =
  | { source: 'investment'; data: InvestmentTransaction }
  | { source: 'ledger'; data: LedgerTransaction };

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
