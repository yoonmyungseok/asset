'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api/client';
import LedgerCalendar from '@/components/ledger/LedgerCalendar';
import TransactionFormModal from '@/components/ledger/TransactionFormModal';
import { useLedgerMonth } from '@/hooks/useLedgerMonth';
import type { Budget, LedgerSummary, LedgerTransaction } from '@/types/api';
import { formatMoney, monthDateRange, todayISO } from '@/lib/utils/format';
import { aggregateDailyTotals } from '@/lib/utils/ledger';

type LedgerView = 'list' | 'calendar';
type FilterType = 'all' | 'expense' | 'income' | 'transfer';

function getTransactionVisual(tx: LedgerTransaction): { icon: string; bg: string } {
  const text = `${tx.category.name} ${tx.category.parent_name || ''} ${tx.merchant || ''} ${tx.memo || ''}`.toLowerCase();

  if (tx.type === 'transfer') {
    return { icon: '↔️', bg: 'bg-[#252832]' };
  }
  if (
    text.includes('이자') ||
    text.includes('세이프박스') ||
    text.includes('예금') ||
    text.includes('적금') ||
    text.includes('배당') ||
    text.includes('금융') ||
    text.includes('은행')
  ) {
    return { icon: '🏦', bg: 'bg-[#202936]' };
  }
  if (
    text.includes('용돈') ||
    text.includes('미션') ||
    text.includes('리워드') ||
    text.includes('앱테크') ||
    text.includes('포인트') ||
    text.includes('캐시') ||
    text.includes('케이뱅크') ||
    text.includes('토스')
  ) {
    return { icon: '📱', bg: 'bg-[#1b2c27]' };
  }
  if (
    text.includes('식비') ||
    text.includes('식사') ||
    text.includes('밥') ||
    text.includes('점심') ||
    text.includes('저녁') ||
    text.includes('외식') ||
    text.includes('배달') ||
    text.includes('버거') ||
    text.includes('치킨') ||
    text.includes('피자') ||
    text.includes('식당')
  ) {
    return { icon: '🍔', bg: 'bg-[#33261f]' };
  }
  if (
    text.includes('카페') ||
    text.includes('커피') ||
    text.includes('스타벅스') ||
    text.includes('투썸') ||
    text.includes('디저트') ||
    text.includes('음료')
  ) {
    return { icon: '☕', bg: 'bg-[#312822]' };
  }
  if (
    text.includes('교통') ||
    text.includes('지하철') ||
    text.includes('버스') ||
    text.includes('택시') ||
    text.includes('주유') ||
    text.includes('기차') ||
    text.includes('ktx')
  ) {
    return { icon: '🚌', bg: 'bg-[#202834]' };
  }
  if (
    text.includes('쇼핑') ||
    text.includes('마트') ||
    text.includes('쿠팡') ||
    text.includes('편의점') ||
    text.includes('의류') ||
    text.includes('백화점') ||
    text.includes('컬리') ||
    text.includes('올리브영')
  ) {
    return { icon: '🛍️', bg: 'bg-[#2f212d]' };
  }
  if (
    text.includes('급여') ||
    text.includes('월급') ||
    text.includes('상여') ||
    text.includes('수당') ||
    text.includes('알바')
  ) {
    return { icon: '💰', bg: 'bg-[#1b2c20]' };
  }
  if (
    text.includes('주거') ||
    text.includes('월세') ||
    text.includes('관리비') ||
    text.includes('공과금') ||
    text.includes('가스') ||
    text.includes('전기') ||
    text.includes('수도') ||
    text.includes('통신')
  ) {
    return { icon: '🏠', bg: 'bg-[#252631]' };
  }
  if (
    text.includes('의료') ||
    text.includes('병원') ||
    text.includes('약국') ||
    text.includes('치과') ||
    text.includes('건강')
  ) {
    return { icon: '💊', bg: 'bg-[#2f2023]' };
  }
  if (
    text.includes('여가') ||
    text.includes('문화') ||
    text.includes('영화') ||
    text.includes('넷플릭스') ||
    text.includes('운동') ||
    text.includes('취미') ||
    text.includes('여행')
  ) {
    return { icon: '🎬', bg: 'bg-[#282233]' };
  }
  if (
    text.includes('교육') ||
    text.includes('책') ||
    text.includes('도서') ||
    text.includes('서점') ||
    text.includes('강의') ||
    text.includes('학원')
  ) {
    return { icon: '📚', bg: 'bg-[#1e2731]' };
  }
  if (tx.type === 'income' || tx.type === 'reimbursement_in') {
    return { icon: '🪙', bg: 'bg-[#1b2c22]' };
  }
  return { icon: '💳', bg: 'bg-[#22242b]' };
}

function formatGroupDateHeader(dateStr: string): string {
  const today = todayISO();
  const [y, m, d] = dateStr.split('-').map(Number);

  if (dateStr === today) {
    return `${d}일 오늘`;
  }

  const todayDate = new Date();
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateStr === yesterdayISO) {
    return `${d}일 어제`;
  }

  const dateObj = new Date(y, m - 1, d);
  const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return `${d}일 ${weekdays[dateObj.getDay()]}`;
}

function getComparisonDiffText(currentExpense: number, prevExpense: number | null): string {
  if (prevExpense === null || prevExpense === 0) {
    return '이번 달 알뜰한 소비를 시작해보세요';
  }
  const diff = currentExpense - prevExpense;
  const abs = Math.abs(diff);
  let formatted = '';
  if (abs >= 100000000) {
    formatted = `${(abs / 100000000).toFixed(1)}억원`;
  } else if (abs >= 10000) {
    const man = Math.round(abs / 10000);
    formatted = `${man.toLocaleString()}만원`;
  } else {
    formatted = `${abs.toLocaleString()}원`;
  }

  if (diff > 0) {
    return `지난달 이때보다 ${formatted} 더 쓰는 중`;
  } else if (diff < 0) {
    return `지난달 이때보다 ${formatted} 덜 쓰는 중`;
  } else {
    return '지난달 이때와 지출 금액이 같아요';
  }
}

export default function LedgerPage() {
  const { year, month, monthQuery, goPrev, goNext } = useLedgerMonth();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [summary, setSummary] = useState({ income: '0', expense: '0', net: '0' });
  const [comparisonSummary, setComparisonSummary] = useState<LedgerSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<LedgerTransaction | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [view, setView] = useState<LedgerView>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { from_date, to_date } = monthDateRange(year, month);
      const params: Record<string, string | number> = { from_date, to_date, page_size: 500 };
      if (search) params.q = search;

      const [txRes, summaryRes, budgetRes] = await Promise.all([
        api.getLedgerTransactions(params),
        api.getLedgerSummary(year, month).catch(() => null),
        api.getBudgets(year, month).catch(() => []),
      ]);

      setTransactions(txRes.items);
      setComparisonSummary(summaryRes);
      setBudgets(budgetRes);

      const income = txRes.items
        .filter((t) => t.type === 'income' || t.type === 'reimbursement_in')
        .reduce((s, t) => s + Number(t.amount), 0);
      const expense = txRes.items
        .filter((t) => t.type === 'expense' || t.type === 'reimbursement_out')
        .reduce((s, t) => s + Number(t.amount), 0);
      setSummary({ income: String(income), expense: String(expense), net: String(income - expense) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [year, month, search]);

  useEffect(() => {
    const today = todayISO();
    const [todayYear, todayMonth] = today.split('-').slice(0, 2).map(Number);
    setSelectedDate(todayYear === year && todayMonth === month ? today : null);
  }, [year, month]);

  const filteredTransactions = useMemo(() => {
    if (filterType === 'all') return transactions;
    if (filterType === 'expense') {
      return transactions.filter((t) => t.type === 'expense' || t.type === 'reimbursement_out');
    }
    if (filterType === 'income') {
      return transactions.filter((t) => t.type === 'income' || t.type === 'reimbursement_in');
    }
    if (filterType === 'transfer') {
      return transactions.filter((t) => t.type === 'transfer');
    }
    return transactions;
  }, [transactions, filterType]);

  const dailyTotals = useMemo(() => aggregateDailyTotals(filteredTransactions), [filteredTransactions]);
  const sortedDates = useMemo(
    () => Object.keys(dailyTotals).sort((a, b) => b.localeCompare(a)),
    [dailyTotals],
  );

  const prevMonthExpense = comparisonSummary?.comparison?.prev_month_expense
    ? Number(comparisonSummary.comparison.prev_month_expense)
    : null;
  const currentExpenseNum = Number(summary.expense);
  const comparisonText = getComparisonDiffText(currentExpenseNum, prevMonthExpense);

  const totalRemainingBudget = useMemo(() => {
    if (!budgets || budgets.length === 0) return null;
    return budgets.reduce((acc, b) => acc + Number(b.remaining), 0);
  }, [budgets]);

  const handleDelete = async (id: number) => {
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

  return (
    <div className="w-full min-h-screen bg-[#121316] px-4 pt-[max(12px,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] font-sans text-gray-200 select-none overflow-x-hidden lg:p-6 lg:pb-12">
      <div className="mx-auto w-full max-w-md">
        {/* 상단 헤더: 타이틀 & 우측 아이콘 버튼들 */}
        <header className="mb-4 flex items-center justify-between pt-1">
          <h1 className="text-xl font-bold tracking-tight text-white">가계부</h1>
          <div className="flex items-center gap-3.5 text-gray-400">
            {/* 분석 바로가기 아이콘 (스파클) */}
            <Link
              href={`/ledger/analysis${monthQuery}`}
              className="transition-colors hover:text-white"
              title="소비 분석"
              aria-label="소비 분석"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              </svg>
            </Link>
            {/* 설정 바로가기 아이콘 */}
            <Link
              href="/settings"
              className="transition-colors hover:text-white"
              title="설정"
              aria-label="설정"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
            {/* 전체 메뉴 아이콘 */}
            <Link
              href={`/ledger/analysis${monthQuery}`}
              className="transition-colors hover:text-white"
              title="더보기"
              aria-label="더보기"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </Link>
          </div>
        </header>

        {/* 월 네비게이션 & 지출/수입 요약 */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={goPrev}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1c1e24] text-base text-gray-300 transition-colors hover:bg-[#252832] hover:text-white"
              aria-label="이전 달"
            >
              ‹
            </button>
            <span className="px-1 text-xl font-bold tracking-tight text-white whitespace-nowrap">{month}월</span>
            <button
              type="button"
              onClick={goNext}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1c1e24] text-base text-gray-300 transition-colors hover:bg-[#252832] hover:text-white"
              aria-label="다음 달"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-0.5 text-right shrink-0 whitespace-nowrap">
            <span className="text-left text-[13px] font-medium text-[#8e95a3] whitespace-nowrap">지출</span>
            <span className="text-[20px] font-bold leading-tight tracking-tight text-white whitespace-nowrap">
              {formatMoney(summary.expense)}
            </span>
            <span className="text-left text-[13px] font-medium text-[#8e95a3] whitespace-nowrap">수입</span>
            <span className="text-[17px] font-bold leading-tight tracking-tight text-[#00d282] whitespace-nowrap">
              {formatMoney(summary.income)}
            </span>
          </div>
        </div>

        {/* 스마트 인사이트 & 예산 카드 */}
        <div className="mb-5 rounded-2xl border border-[#262932] bg-[#1c1e24] p-4 shadow-sm">
          {/* 전월 대비 분석 row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 text-xl" role="img" aria-label="insight">
                🐱
              </span>
              <span className="truncate text-[13px] font-medium text-gray-200">{comparisonText}</span>
            </div>
            <Link
              href={`/ledger/analysis${monthQuery}`}
              className="shrink-0 rounded-lg bg-[#272b35] px-2.5 py-1 text-xs font-medium text-gray-300 transition-colors hover:bg-[#323742] hover:text-white"
            >
              분석
            </Link>
          </div>

          <div className="my-3 border-t border-[#262932]" />

          {/* 남은 예산 row */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-gray-400">남은 예산</span>
            <Link
              href={`/ledger/budget${monthQuery}`}
              className="flex items-center gap-1 text-[13px] font-bold text-white transition-colors hover:text-gray-200"
            >
              <span>
                {totalRemainingBudget !== null ? formatMoney(totalRemainingBudget) : '예산 설정하기'}
              </span>
              <span className="text-xs text-gray-500">›</span>
            </Link>
          </div>
        </div>

        {/* 툴바: 뷰 전환 (목록 / 달력), 필터, 검색, 추가 */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* 세그먼트 버튼 (목록 / 달력) */}
            <div className="flex items-center rounded-xl border border-[#272a33] bg-[#1a1c22] p-1">
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  view === 'list' ? 'bg-[#2c303c] text-white shadow-sm' : 'text-[#7e8494] hover:text-gray-300'
                }`}
                onClick={() => setView('list')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                목록
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  view === 'calendar' ? 'bg-[#2c303c] text-white shadow-sm' : 'text-[#7e8494] hover:text-gray-300'
                }`}
                onClick={() => setView('calendar')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                달력
              </button>
            </div>

            {/* 필터 셀렉트 */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="cursor-pointer appearance-none rounded-xl border border-[#272a33] bg-[#1a1c22] px-3 py-1.5 pr-6 text-xs font-semibold text-gray-200 transition-colors focus:border-gray-500 focus:outline-none"
              >
                <option value="all">필터 ∨</option>
                <option value="expense">지출만</option>
                <option value="income">수입만</option>
                <option value="transfer">이체만</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 검색 토글 버튼 */}
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${
                showSearch
                  ? 'border-gray-500 bg-[#2b2e38] text-white'
                  : 'border-[#272a33] bg-[#1a1c22] text-gray-400 hover:text-white'
              }`}
              aria-label="검색"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* 거래 추가 버튼 */}
            <button
              type="button"
              onClick={openCreateForm}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#262a34] text-xl font-light text-white transition-colors hover:bg-[#323744]"
              aria-label="거래 추가"
            >
              +
            </button>
          </div>
        </div>

        {/* 펼침 검색 바 */}
        {showSearch && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#272a33] bg-[#1a1c22] px-3 py-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="내역, 가맹점, 메모 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-xs text-gray-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* 컨텐츠 뷰 */}
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-500">로딩 중...</div>
        ) : view === 'calendar' ? (
          <div className="space-y-4">
            <LedgerCalendar
              year={year}
              month={month}
              dailyTotals={dailyTotals}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              darkMode={true}
            />

            {selectedDate && (
              <div className="rounded-2xl border border-[#262932] bg-[#1c1e24] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-300">
                    {formatGroupDateHeader(selectedDate)}
                  </h3>
                  {dailyTotals[selectedDate] && (() => {
                    const net = dailyTotals[selectedDate].income - dailyTotals[selectedDate].expense;
                    return (
                      <span
                        className={`text-sm font-bold ${
                          net >= 0 ? 'text-[#00d282]' : 'text-gray-400'
                        }`}
                      >
                        {net >= 0 ? '+' : ''}
                        {formatMoney(net)}
                      </span>
                    );
                  })()}
                </div>

                {dailyTotals[selectedDate]?.transactions.length ? (
                  <div className="space-y-1">
                    {dailyTotals[selectedDate].transactions.map((tx) => {
                      const visual = getTransactionVisual(tx);
                      const isIncome = tx.type === 'income' || tx.type === 'reimbursement_in';
                      const isTransfer = tx.type === 'transfer';
                      const primaryLabel =
                        tx.merchant ||
                        tx.memo ||
                        (tx.category.parent_name
                          ? `${tx.category.parent_name} › ${tx.category.name}`
                          : tx.category.name);
                      const secondaryLabel = `${tx.category.name}${tx.account_name ? ` | ${tx.account_name}` : ''}`;

                      return (
                        <div
                          key={tx.id}
                          onClick={() => openEditForm(tx)}
                          className="flex cursor-pointer items-center justify-between rounded-xl px-2 py-2.5 transition-colors hover:bg-[#232630] active:bg-[#282c38]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${visual.bg}`}
                            >
                              {visual.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[15px] font-medium tracking-tight text-white">
                                {primaryLabel}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-gray-400">
                                {secondaryLabel}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div
                              className={`text-[15px] font-bold tracking-tight ${
                                isIncome
                                  ? 'text-[#00d282]'
                                  : isTransfer
                                    ? 'text-gray-300'
                                    : 'text-white'
                              }`}
                            >
                              {isIncome ? `+${formatMoney(tx.amount)}` : isTransfer ? `↔${formatMoney(tx.amount)}` : `-${formatMoney(tx.amount)}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-gray-500">
                    거래 내역이 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="my-10 rounded-2xl border border-[#262932] bg-[#1c1e24] p-8 text-center">
            <div className="mb-2 text-3xl">📝</div>
            <div className="text-base font-semibold text-white">거래 내역이 없습니다</div>
            <p className="mt-1 text-xs text-gray-400">첫 수입/지출을 기록해보세요.</p>
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-600"
            >
              + 거래 추가
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {sortedDates.map((date) => {
              const dayGroup = dailyTotals[date];
              const transactionsForDate = dayGroup.transactions;
              const dayIncome = transactionsForDate
                .filter((t) => t.type === 'income' || t.type === 'reimbursement_in')
                .reduce((s, t) => s + Number(t.amount), 0);
              const dayExpense = transactionsForDate
                .filter((t) => t.type === 'expense' || t.type === 'reimbursement_out')
                .reduce((s, t) => s + Number(t.amount), 0);
              const dayNet = dayIncome - dayExpense;

              return (
                <div key={date}>
                  {/* 날짜 헤더 & 일별 합계 */}
                  <div className="flex items-center justify-between pb-1.5 pt-1">
                    <span className="text-[13px] font-semibold text-gray-400">
                      {formatGroupDateHeader(date)}
                    </span>
                    <span
                      className={`text-[13px] font-semibold ${
                        dayNet > 0 ? 'text-[#00d282]' : 'text-gray-400'
                      }`}
                    >
                      {dayNet > 0 ? `+${formatMoney(dayNet)}` : dayNet < 0 ? `-${formatMoney(Math.abs(dayNet))}` : `${formatMoney(0)}`}
                    </span>
                  </div>

                  {/* 해당 일자의 거래 목록 */}
                  <div className="space-y-0.5">
                    {transactionsForDate.map((tx) => {
                      const visual = getTransactionVisual(tx);
                      const isIncome = tx.type === 'income' || tx.type === 'reimbursement_in';
                      const isTransfer = tx.type === 'transfer';
                      const primaryLabel =
                        tx.merchant ||
                        tx.memo ||
                        (tx.category.parent_name
                          ? `${tx.category.parent_name} › ${tx.category.name}`
                          : tx.category.name);
                      const secondaryLabel = `${tx.category.name}${tx.account_name ? ` | ${tx.account_name}` : ''}`;

                      return (
                        <div
                          key={tx.id}
                          onClick={() => openEditForm(tx)}
                          className="flex cursor-pointer items-center justify-between rounded-xl px-1.5 py-2.5 transition-colors hover:bg-[#181a21] active:bg-[#20232d]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${visual.bg}`}
                            >
                              {visual.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[15px] font-medium tracking-tight text-white">
                                {primaryLabel}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-gray-400">
                                {secondaryLabel}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 pl-3 text-right">
                            <div
                              className={`text-[15px] font-bold tracking-tight ${
                                isIncome
                                  ? 'text-[#00d282]'
                                  : isTransfer
                                    ? 'text-gray-300'
                                    : 'text-white'
                              }`}
                            >
                              {isIncome ? `+${formatMoney(tx.amount)}` : isTransfer ? `↔${formatMoney(tx.amount)}` : `-${formatMoney(tx.amount)}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 거래 등록/수정 모달 */}
        <TransactionFormModal
          open={showForm}
          transaction={editingTransaction}
          onClose={closeForm}
          onSaved={load}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
