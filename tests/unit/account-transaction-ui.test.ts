import { describe, expect, it } from 'vitest';

import {
  allowedInvestmentTxTypes,
  cashOnlyHelpText,
  investmentTxModalTitle,
  resolveAccountTransactionUiMode,
} from '@/lib/utils/account-transaction-ui';

describe('resolveAccountTransactionUiMode', () => {
  it('uses investment mode when holdings are supported', () => {
    expect(
      resolveAccountTransactionUiMode({ category: 'cash', supports_holdings: true }),
    ).toBe('investment');
    expect(
      resolveAccountTransactionUiMode({ category: 'investment', supports_holdings: true }),
    ).toBe('investment');
  });

  it('maps cash and deposit categories without holdings', () => {
    expect(
      resolveAccountTransactionUiMode({ category: 'cash', supports_holdings: false }),
    ).toBe('cash');
    expect(
      resolveAccountTransactionUiMode({ category: 'deposit', supports_holdings: false }),
    ).toBe('savings');
  });

  it('falls back to cash for other categories without holdings', () => {
    expect(
      resolveAccountTransactionUiMode({ category: 'investment', supports_holdings: false }),
    ).toBe('cash');
  });
});

describe('allowedInvestmentTxTypes', () => {
  it('lists full trade types for investment accounts', () => {
    expect(allowedInvestmentTxTypes('investment')).toEqual([
      'buy',
      'sell',
      'deposit',
      'withdraw',
      'dividend',
      'interest',
      'fee',
    ]);
  });

  it('restricts cash and savings accounts', () => {
    expect(allowedInvestmentTxTypes('cash')).toEqual(['deposit', 'withdraw', 'fee']);
    expect(allowedInvestmentTxTypes('savings')).toEqual([
      'deposit',
      'withdraw',
      'interest',
      'fee',
    ]);
  });
});

describe('investmentTxModalTitle', () => {
  it('labels modals by mode and edit state', () => {
    expect(investmentTxModalTitle('investment', false)).toBe('투자 거래 추가');
    expect(investmentTxModalTitle('cash', true)).toBe('잔고 조정 수정');
    expect(investmentTxModalTitle('savings', false)).toBe('잔고·이자');
  });
});

describe('cashOnlyHelpText', () => {
  it('defers to modal logic for investment mode', () => {
    expect(cashOnlyHelpText('investment', 'deposit')).toBeNull();
  });

  it('returns balance-only hints for cash-like modes', () => {
    expect(cashOnlyHelpText('cash', 'withdraw')).toBe('이 거래는 예수금만 변경합니다.');
    expect(cashOnlyHelpText('savings', 'interest')).toBe('이자는 예수금만 증가합니다.');
  });
});
