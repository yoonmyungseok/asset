'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/AppLayout';
import LedgerCalendar from '@/components/ledger/LedgerCalendar';
import LedgerTransactionGroup from '@/components/ledger/LedgerTransactionGroup';
import MonthNavigator from '@/components/ledger/MonthNavigator';
import TransactionFormModal from '@/components/ledger/TransactionFormModal';
import { useLedgerMonth } from '@/hooks/useLedgerMonth';
import type { LedgerTransaction } from '@/types/api';
import { formatMoney, formatShortDate, monthDateRange, todayISO } from '@/lib/utils/format';
import { aggregateDailyTotals } from '@/lib/utils/ledger';

type LedgerView = 'list' | 'calendar';

export default function LedgerPage() {
  const { year, month, monthQuery } = useLedgerMonth();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [summary, setSummary] = useState({ income: '0', expense: '0', net: '0' });
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<LedgerTransaction | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<LedgerView>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { from_date, to_date } = monthDateRange(year, month);
      const params: Record<string, string | number> = { from_date, to_date, page_size: 200 };
      if (search) params.q = search;
      const res = await api.getLedgerTransactions(params);
      setTransactions(res.items);
      const income = res.items.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = res.items.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      setSummary({ income: String(income), expense: String(expense), net: String(income - expense) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year, month, search]);

  useEffect(() => {
    const today = todayISO();
    const [todayYear, todayMonth] = today.split('-').slice(0, 2).map(Number);
    setSelectedDate(todayYear === year && todayMonth === month ? today : null);
  }, [year, month]);

  const dailyTotals = useMemo(() => aggregateDailyTotals(transactions), [transactions]);
  const sortedDates = useMemo(
    () => Object.keys(dailyTotals).sort((a, b) => b.localeCompare(a)),
    [dailyTotals],
  );

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.deleteLedgerTransaction(id);
    load();
  };

  const openCreateForm = () => {
    setEditingTransaction(null);
    setShowForm(true);
  };

  const openEditForm = (tx: LedgerTransaction) => {
    setEditingTransaction(tx);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const monthSummary = (
    <div className="month-summary">
      <span>수입 <strong className="text-success">{formatMoney(summary.income)}</strong></span>
      <span>지출 <strong className="text-danger">{formatMoney(summary.expense)}</strong></span>
      <span>순수입 <strong>{formatMoney(summary.net)}</strong></span>
    </div>
  );

  return (
    <>
      <PageHeader
        title="가계부"
        actions={
          <>
            <Link href={`/ledger/analysis${monthQuery}`} className="btn btn-secondary">분석</Link>
            <Link href={`/ledger/budget${monthQuery}`} className="btn btn-secondary">예산</Link>
            <button className="btn btn-primary" onClick={openCreateForm}>+ 거래 추가</button>
          </>
        }
      />

      <div className="filters">
        <MonthNavigator />
        <div className="view-toggle">
          <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            목록
          </button>
          <button type="button" className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>
            달력
          </button>
        </div>
        {view === 'list' && (
          <input placeholder="검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : view === 'calendar' ? (
        <>
          <LedgerCalendar
            year={year}
            month={month}
            dailyTotals={dailyTotals}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          {selectedDate ? (
            dailyTotals[selectedDate]?.transactions.length ? (
              <div className="card mt-4">
                <h3 className="section-title mt-0">{formatShortDate(selectedDate)} 거래</h3>
                <LedgerTransactionGroup
                  date={selectedDate}
                  transactions={dailyTotals[selectedDate].transactions}
                  showHeader={false}
                  onEdit={openEditForm}
                  onDelete={handleDelete}
                />
              </div>
            ) : (
              <div className="card ledger-calendar-empty-day mt-4">
                <p>{formatShortDate(selectedDate)} 거래 내역이 없습니다.</p>
              </div>
            )
          ) : (
            <div className="card ledger-calendar-empty-day mt-4">
              <p>날짜를 선택하면 해당 일의 거래 내역을 볼 수 있습니다.</p>
            </div>
          )}
          {monthSummary}
        </>
      ) : transactions.length === 0 ? (
        <div className="empty-state card">
          <h3>거래 내역이 없습니다</h3>
          <p>첫 수입/지출을 기록해보세요.</p>
          <button className="btn btn-primary" onClick={openCreateForm}>+ 거래 추가</button>
        </div>
      ) : (
        <div className="card">
          {sortedDates.map((date) => (
            <LedgerTransactionGroup
              key={date}
              date={date}
              transactions={dailyTotals[date].transactions}
              onEdit={openEditForm}
              onDelete={handleDelete}
            />
          ))}
          {monthSummary}
        </div>
      )}

      <TransactionFormModal
        open={showForm}
        transaction={editingTransaction}
        onClose={closeForm}
        onSaved={load}
      />
    </>
  );
}
