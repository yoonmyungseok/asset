import type { AccountType } from '@/types/api';

export type AccountTransactionUiMode = 'investment' | 'cash' | 'savings';

const INVESTMENT_TX_TYPES = [
  'buy',
  'sell',
  'deposit',
  'withdraw',
  'dividend',
  'interest',
  'fee',
] as const;

const CASH_TX_TYPES = ['deposit', 'withdraw', 'fee'] as const;

const SAVINGS_TX_TYPES = ['deposit', 'withdraw', 'interest', 'fee'] as const;

export function resolveAccountTransactionUiMode(
  accountType: Pick<AccountType, 'category' | 'supports_holdings'>,
): AccountTransactionUiMode {
  if (accountType.supports_holdings) {
    return 'investment';
  }
  if (accountType.category === 'cash') {
    return 'cash';
  }
  if (accountType.category === 'deposit') {
    return 'savings';
  }
  // investment/pension 등 category여도 보유종목 미지원이면 예수금만 조정하는 cash UX
  return 'cash';
}

export function allowedInvestmentTxTypes(mode: AccountTransactionUiMode): readonly string[] {
  switch (mode) {
    case 'investment':
      return INVESTMENT_TX_TYPES;
    case 'cash':
      return CASH_TX_TYPES;
    case 'savings':
      return SAVINGS_TX_TYPES;
  }
}

export function investmentTxModalTitle(mode: AccountTransactionUiMode, isEditing: boolean): string {
  switch (mode) {
    case 'investment':
      return isEditing ? '투자 거래 수정' : '투자 거래 추가';
    case 'cash':
      return isEditing ? '잔고 조정 수정' : '잔고 조정';
    case 'savings':
      return isEditing ? '잔고·이자 수정' : '잔고·이자';
  }
}

export function cashOnlyHelpText(mode: AccountTransactionUiMode, txType: string): string | null {
  if (mode === 'investment') {
    return null;
  }
  if (txType === 'interest') {
    return '이자는 예수금만 증가합니다.';
  }
  return '이 거래는 예수금만 변경합니다.';
}
