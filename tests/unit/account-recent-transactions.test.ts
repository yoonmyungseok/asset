import { describe, expect, it } from 'vitest';

import {
  attachRecentTransactionBalances,
  mergeAccountRecentTransactions,
  recentTransactionCashDelta,
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

describe('recentTransactionCashDelta', () => {
  it('computes deltas for investment transactions', () => {
    expect(recentTransactionCashDelta({ source: 'investment', data: investmentTx({ id: 1, transaction_date: '2026-11-25', type: 'deposit', amount: '10000' }) }, 1).toFixed()).toBe('10000');
    expect(recentTransactionCashDelta({ source: 'investment', data: investmentTx({ id: 2, transaction_date: '2026-11-25', type: 'withdraw', amount: '4000' }) }, 1).toFixed()).toBe('-4000');
    expect(recentTransactionCashDelta({ source: 'investment', data: investmentTx({ id: 3, transaction_date: '2026-11-25', type: 'buy', amount: '10000', fee: '500' }) }, 1).toFixed()).toBe('-10500');
    expect(recentTransactionCashDelta({ source: 'investment', data: investmentTx({ id: 4, transaction_date: '2026-11-25', type: 'sell', amount: '10000', fee: '100', tax: '200' }) }, 1).toFixed()).toBe('9700');
    expect(recentTransactionCashDelta({ source: 'investment', data: investmentTx({ id: 5, transaction_date: '2026-11-25', type: 'interest', amount: '300', holding_id: null }) }, 1).toFixed()).toBe('300');
    expect(recentTransactionCashDelta({ source: 'investment', data: investmentTx({ id: 6, transaction_date: '2026-11-25', type: 'interest', amount: '300', holding_id: 99 }) }, 1).toFixed()).toBe('0');
  });

  it('computes deltas for ledger transactions', () => {
    expect(recentTransactionCashDelta({ source: 'ledger', data: ledgerTx({ id: 1, transaction_date: '2026-11-25', type: 'transfer', account_id: 1, to_account_id: 2, amount: '50000' }) }, 1).toFixed()).toBe('-50000');
    expect(recentTransactionCashDelta({ source: 'ledger', data: ledgerTx({ id: 1, transaction_date: '2026-11-25', type: 'transfer', account_id: 1, to_account_id: 2, amount: '50000' }) }, 2).toFixed()).toBe('50000');
    expect(recentTransactionCashDelta({ source: 'ledger', data: ledgerTx({ id: 2, transaction_date: '2026-11-25', type: 'income', account_id: 1, to_account_id: null, amount: '62150' }) }, 1).toFixed()).toBe('62150');
    expect(recentTransactionCashDelta({ source: 'ledger', data: ledgerTx({ id: 3, transaction_date: '2026-11-25', type: 'expense', account_id: 1, to_account_id: null, amount: '11600', payment_method: { id: 1, name: '계좌이체' }, card: null }) }, 1).toFixed()).toBe('-11600');
    expect(recentTransactionCashDelta({ source: 'ledger', data: ledgerTx({ id: 4, transaction_date: '2026-11-25', type: 'expense', account_id: 1, to_account_id: null, amount: '5000', payment_method: { id: 2, name: '카드' }, card: { id: 1, name: '체크카드', card_type: 'debit', institution: null, last_four: null } }) }, 1).toFixed()).toBe('-5000');
    expect(recentTransactionCashDelta({ source: 'ledger', data: ledgerTx({ id: 5, transaction_date: '2026-11-25', type: 'expense', account_id: 1, to_account_id: null, amount: '5000', payment_method: { id: 2, name: '카드' }, card: { id: 2, name: '신용카드', card_type: 'credit', institution: null, last_four: null } }) }, 1).toFixed()).toBe('0');
  });
});

describe('attachRecentTransactionBalances', () => {
  it('calculates running balance backwards from current cash balance', () => {
    const transactions = mergeAccountRecentTransactions(
      [investmentTx({ id: 10, transaction_date: '2026-11-20', type: 'deposit', amount: '100000' })],
      [
        ledgerTx({ id: 20, transaction_date: '2026-11-25', type: 'expense', account_id: 1, to_account_id: null, amount: '11600', payment_method: { id: 1, name: '계좌이체' }, card: null }),
        ledgerTx({ id: 19, transaction_date: '2026-11-21', type: 'transfer', account_id: 2, to_account_id: 1, amount: '50000' }),
      ],
      20,
    );

    const withBalances = attachRecentTransactionBalances(transactions, '213188', 1);

    expect(withBalances.map((item) => item.balanceAfter)).toEqual([
      '213188', // 2026-11-25 지출 -11,600원 직후
      '224788', // 2026-11-21 입금이체 +50,000원 직후
      '174788', // 2026-11-20 입금 +100,000원 직후
    ]);
  });
});
