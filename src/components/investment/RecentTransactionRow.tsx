'use client';

import type {
  AccountRecentTransaction,
  AccountRecentTransactionWithBalance,
} from '@/lib/utils/account-recent-transactions';
import {
  recentTransactionDetailLabel,
  recentTransactionMemo,
  recentTransactionTypeLabel,
} from '@/lib/utils/account-recent-transactions';
import { formatMoney } from '@/lib/utils/format';

interface Props {
  item: AccountRecentTransactionWithBalance;
  accountId: number;
  onEdit: (item: AccountRecentTransaction) => void;
  onDelete: (item: AccountRecentTransaction) => void;
}

function txRowModifier(item: AccountRecentTransaction): string {
  if (item.source === 'ledger') {
    return `tx-row--${item.data.type}`;
  }
  if (item.data.type === 'buy' || item.data.type === 'deposit' || item.data.type === 'dividend' || item.data.type === 'interest') {
    return 'tx-row--income';
  }
  if (item.data.type === 'sell' || item.data.type === 'withdraw' || item.data.type === 'fee') {
    return 'tx-row--expense';
  }
  return '';
}

export default function RecentTransactionRow({ item, accountId, onEdit, onDelete }: Props) {
  const memo = recentTransactionMemo(item);
  const modifier = txRowModifier(item);

  return (
    <div className={`tx-row ${modifier}`}>
      <div className="tx-row-left">
        <span className="text-muted text-xs">{item.data.transaction_date}</span>
        <span className="category-type-badge">{recentTransactionTypeLabel(item)}</span>
        <span className="tx-category">{recentTransactionDetailLabel(item, accountId)}</span>
        {memo && <span className="tx-merchant">{memo}</span>}
      </div>
      <div className="tx-row-actions">
        <div className="flex flex-col">
          <span className="font-semibold">{formatMoney(item.data.amount)}</span>
          <span className="text-xs text-muted">잔액 {formatMoney(item.balanceAfter)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm btn-secondary" onClick={() => onEdit(item)}>수정</button>
          <button className="btn btn-sm btn-danger" onClick={() => onDelete(item)}>삭제</button>
        </div>
      </div>
    </div>
  );
}
