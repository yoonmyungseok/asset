import { describe, expect, it } from 'vitest';

import {
  mergeAccountRecentTransactions,
  recentTransactionDetailLabel,
  recentTransactionTypeLabel,
} from '@/lib/utils/account-recent-transactions';
import type { InvestmentTransaction, LedgerTransaction } from '@/types/api';

function investmentTx(overrides: Partial<InvestmentTransaction> & Pick<InvestmentTransaction, 'id' | 'transaction_date'>): InvestmentTransaction {
  return {
    id: overrides.id,
    account_id: 1,
    holding_id: null,
    type: 'deposit',
    transaction_date: overrides.transaction_date,
    amount: '10000',
    quantity: null,
    price: null,
    fee: '0',
    tax: '0',
    memo: null,
    holding_name: null,
    holding_symbol: null,
    ...overrides,
  };
}

function ledgerTx(overrides: Partial<LedgerTransaction> & Pick<LedgerTransaction, 'id' | 'transaction_date'>): LedgerTransaction {
  return {
    id: overrides.id,
    transaction_date: overrides.transaction_date,
    type: 'transfer',
    amount: '50000',
    category: { id: 1, name: '내부이체', parent_name: null },
    payment_method: { id: 1, name: '계좌이체' },
    account_id: 1,
    to_account_id: 2,
    account_name: '당근머니 하나 통장',
    to_account_name: '토스 기본',
    card: null,
    merchant: null,
    memo: null,
    is_fixed: false,
    tags: [],
    ...overrides,
  };
}

describe('mergeAccountRecentTransactions', () => {
  it('merges and sorts by date descending', () => {
    const merged = mergeAccountRecentTransactions(
      [investmentTx({ id: 1, transaction_date: '2026-09-01' })],
      [ledgerTx({ id: 2, transaction_date: '2026-09-06' })],
      20,
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('ledger');
    expect(merged[0].data.id).toBe(2);
    expect(merged[1].source).toBe('investment');
  });

  it('respects the limit', () => {
    const merged = mergeAccountRecentTransactions(
      [
        investmentTx({ id: 1, transaction_date: '2026-09-03' }),
        investmentTx({ id: 2, transaction_date: '2026-09-02' }),
      ],
      [ledgerTx({ id: 3, transaction_date: '2026-09-01' })],
      2,
    );

    expect(merged).toHaveLength(2);
  });
});

describe('recentTransactionTypeLabel', () => {
  it('labels ledger transfers as 이체', () => {
    expect(
      recentTransactionTypeLabel({ source: 'ledger', data: ledgerTx({ id: 1, transaction_date: '2026-09-06' }) }),
    ).toBe('이체');
  });
});

describe('recentTransactionDetailLabel', () => {
  it('shows outgoing transfer direction from source account', () => {
    const label = recentTransactionDetailLabel(
      { source: 'ledger', data: ledgerTx({ id: 1, transaction_date: '2026-09-06' }) },
      1,
    );
    expect(label).toBe('→ 토스 기본');
  });

  it('shows incoming transfer direction on destination account', () => {
    const label = recentTransactionDetailLabel(
      { source: 'ledger', data: ledgerTx({ id: 1, transaction_date: '2026-09-06' }) },
      2,
    );
    expect(label).toBe('← 당근머니 하나 통장');
  });
});
