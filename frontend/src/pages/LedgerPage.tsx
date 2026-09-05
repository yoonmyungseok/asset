import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { PageHeader } from '../components/layout/AppLayout';
import TransactionFormModal from '../components/ledger/TransactionFormModal';
import type { LedgerTransaction } from '../types/api';
import { currentYearMonth, formatMoney, formatShortDate, LEDGER_TX_TYPES } from '../utils/format';

export default function LedgerPage() {
  const { year, month } = currentYearMonth();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [summary, setSummary] = useState({ income: '0', expense: '0', net: '0' });
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getLedgerTransactions({
        from_date: `${year}-${String(month).padStart(2, '0')}-01`,
        to_date: `${year}-${String(month).padStart(2, '0')}-31`,
        q: search || undefined,
        page_size: 200,
      });
      setTransactions(res.items);
      const income = res.items.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = res.items.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      setSummary({ income: String(income), expense: String(expense), net: String(income - expense) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year, month, search]);

  const grouped = transactions.reduce<Record<string, LedgerTransaction[]>>((acc, tx) => {
    (acc[tx.transaction_date] ??= []).push(tx);
    return acc;
  }, {});

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.deleteLedgerTransaction(id);
    load();
  };

  return (
    <>
      <PageHeader
        title="가계부"
        actions={
          <>
            <Link to="/ledger/analysis" className="btn btn-secondary">분석</Link>
            <Link to="/ledger/budget" className="btn btn-secondary">예산</Link>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 거래 추가</button>
          </>
        }
      />

      <div className="filters">
        <span>{year}년 {month}월</span>
        <input placeholder="검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state card">
          <h3>거래 내역이 없습니다</h3>
          <p>첫 수입/지출을 기록해보세요.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 거래 추가</button>
        </div>
      ) : (
        <div className="card">
          {Object.entries(grouped).map(([date, txs]) => (
            <div key={date}>
              <div className="tx-group-date">{formatShortDate(date)}</div>
              {txs.map((tx) => {
                const transferLabel =
                  tx.type === 'transfer' && tx.account_name && tx.to_account_name
                    ? `${tx.account_name} → ${tx.to_account_name}`
                    : null;
                return (
                <div key={tx.id} className={`tx-row tx-row--${tx.type}`}>
                  <div className="tx-row-left">
                    <span className={`category-type-badge category-type-badge--${tx.type}`}>
                      {LEDGER_TX_TYPES[tx.type] ?? tx.type}
                    </span>
                    <span className="tx-category">
                      {tx.type === 'transfer'
                        ? transferLabel ?? tx.category.name
                        : tx.category.parent_name
                          ? `${tx.category.parent_name} › ${tx.category.name}`
                          : tx.category.name}
                    </span>
                    <span className="tx-merchant">{tx.merchant || tx.memo || ''}</span>
                    {tx.is_fixed && <span className="text-muted" style={{ fontSize: 12 }}>고정</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className={
                      tx.type === 'income'
                        ? 'tx-amount-income'
                        : tx.type === 'transfer'
                          ? 'text-muted'
                          : 'tx-amount-expense'
                    }>
                      {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '↔' : '-'}
                      {formatMoney(tx.amount)}
                    </span>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(tx.id)}>삭제</button>
                  </div>
                </div>
                );
              })}
            </div>
          ))}
          <div className="month-summary">
            <span>수입 <strong className="text-success">{formatMoney(summary.income)}</strong></span>
            <span>지출 <strong className="text-danger">{formatMoney(summary.expense)}</strong></span>
            <span>순수입 <strong>{formatMoney(summary.net)}</strong></span>
          </div>
        </div>
      )}

      <TransactionFormModal open={showForm} onClose={() => setShowForm(false)} onSaved={load} />
    </>
  );
}
