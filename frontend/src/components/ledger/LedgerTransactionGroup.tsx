import type { LedgerTransaction } from '../../types/api';
import { formatMoney, formatShortDate, LEDGER_TX_TYPES } from '../../utils/format';

interface Props {
  date: string;
  transactions: LedgerTransaction[];
  showHeader?: boolean;
  onEdit: (tx: LedgerTransaction) => void;
  onDelete: (id: number) => void;
}

function amountClass(type: LedgerTransaction['type']) {
  if (type === 'income' || type === 'reimbursement_in') return 'tx-amount-income';
  if (type === 'expense' || type === 'reimbursement_out') return 'tx-amount-expense';
  return 'text-muted';
}

function amountPrefix(type: LedgerTransaction['type']) {
  if (type === 'income' || type === 'reimbursement_in') return '+';
  if (type === 'transfer') return '↔';
  return '-';
}

export default function LedgerTransactionGroup({ date, transactions, showHeader = true, onEdit, onDelete }: Props) {
  const dayIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const dayExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const dayNet = dayIncome - dayExpense;

  return (
    <div>
      {showHeader && (
        <div className="tx-group-date">
          <span>{formatShortDate(date)}</span>
          <div className="tx-group-daily-summary">
            {dayIncome > 0 && (
              <span className="text-success">수입 {formatMoney(dayIncome)}</span>
            )}
            {dayExpense > 0 && (
              <span className="text-danger">지출 {formatMoney(dayExpense)}</span>
            )}
            {(dayIncome > 0 || dayExpense > 0) && (
              <span className={dayNet >= 0 ? 'text-success' : 'text-danger'}>
                순 {dayNet >= 0 ? '+' : ''}{formatMoney(dayNet)}
              </span>
            )}
          </div>
        </div>
      )}
      {transactions.map((tx) => {
        const transferLabel =
          tx.type === 'transfer' && tx.account_name && tx.to_account_name
            ? `${tx.account_name} → ${tx.to_account_name}`
            : null;
        const isReimbursement = tx.type === 'reimbursement_out' || tx.type === 'reimbursement_in';
        const primaryLabel =
          tx.type === 'transfer'
            ? transferLabel ?? tx.category.name
            : isReimbursement
              ? (tx.merchant || tx.memo || tx.category.name)
              : tx.category.parent_name
                ? `${tx.category.parent_name} › ${tx.category.name}`
                : tx.category.name;
        const secondaryLabel = isReimbursement
          ? (tx.account_name ?? '')
          : (tx.merchant || tx.memo || '');

        return (
          <div key={tx.id} className={`tx-row tx-row--${tx.type}`}>
            <div className="tx-row-left">
              <span className={`category-type-badge category-type-badge--${tx.type}`}>
                {LEDGER_TX_TYPES[tx.type] ?? tx.type}
              </span>
              <span className="tx-category">{primaryLabel}</span>
              {secondaryLabel && (
                <span className="tx-merchant">{secondaryLabel}</span>
              )}
              {tx.is_fixed && <span className="text-muted" style={{ fontSize: 12 }}>고정</span>}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className={amountClass(tx.type)}>
                {amountPrefix(tx.type)}
                {formatMoney(tx.amount)}
              </span>
              <button className="btn btn-sm btn-secondary" onClick={() => onEdit(tx)}>수정</button>
              <button className="btn btn-sm btn-danger" onClick={() => onDelete(tx.id)}>삭제</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
