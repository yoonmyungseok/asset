'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import CategorySpendingBreakdown from '@/components/ledger/CategorySpendingBreakdown';
import MonthNavigator from '@/components/ledger/MonthNavigator';
import { useLedgerMonth } from '@/hooks/useLedgerMonth';
import type { LedgerSummary } from '@/types/api';
import { CARD_TYPES, formatMoney } from '@/lib/utils/format';

export default function LedgerAnalysisPage() {
  const { year, month, monthQuery } = useLedgerMonth();
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await api.getLedgerSummary(year, month);
      setSummary(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshDashboard();
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center bg-[#121316] text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span>분석 데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const sortedCards = [...summary.by_card].sort(
    (a, b) => Number(b.amount) - Number(a.amount),
  );
  const totalCardExpense = sortedCards.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="w-full min-h-screen bg-[#121316] p-4 pb-[calc(7.2rem+max(12px,env(safe-area-inset-bottom,0px)))] lg:p-6 lg:pb-6 font-sans text-gray-200 overflow-x-hidden">
      {/* 상단 헤더: 다른 페이지의 PageHeader(mb-6, text-xl lg:text-2xl)와 동일한 규격 */}
      <header className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white lg:text-2xl">가계부 분석</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-xl border border-[#272a33] bg-[#1a1c22] px-3.5 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-[#252834] hover:text-white disabled:opacity-50"
          >
            <span>{refreshing ? '갱신 중...' : '새로고침 ↻'}</span>
          </button>
          <Link
            href={`/ledger${monthQuery}`}
            className="flex items-center gap-1 rounded-xl border border-[#272a33] bg-[#1a1c22] px-3.5 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-[#252834] hover:text-white"
          >
            <span>←</span> 거래목록
          </Link>
        </div>
      </header>

      {/* 월 네비게이터 */}
      <div className="mb-4">
        <MonthNavigator />
      </div>

      {/* 카테고리별 지출 카드 */}
      <CategorySpendingBreakdown
        categories={summary.by_category}
        totalExpense={summary.total_expense}
      />

      {/* 전월 대비 지출 변화 카드 */}
      {summary.comparison && (
        <div className="mb-4 rounded-2xl border border-[#262932] bg-[#1c1e24] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">전월 대비</h2>
            {summary.comparison.expense_change_rate && (
              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${
                  Number(summary.comparison.expense_change_rate) > 0
                    ? 'bg-red-950/40 text-red-400 border-red-800/40'
                    : 'bg-emerald-950/40 text-[#00d282] border-emerald-800/40'
                }`}
              >
                {Number(summary.comparison.expense_change_rate) > 0 ? '+' : ''}
                {summary.comparison.expense_change_rate}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#262932]/70 bg-[#15171c] p-3.5">
              <span className="mb-1 block text-xs text-gray-400">이번 달 지출</span>
              <span className="text-lg font-bold text-white">{formatMoney(summary.total_expense)}</span>
            </div>
            <div className="rounded-xl border border-[#262932]/70 bg-[#15171c] p-3.5">
              <span className="mb-1 block text-xs text-gray-400">전월 지출</span>
              <span className="text-lg font-bold text-gray-300">
                {formatMoney(summary.comparison.prev_month_expense)}
              </span>
            </div>
            <div className="rounded-xl border border-[#262932]/70 bg-[#15171c] p-3.5">
              <span className="mb-1 block text-xs text-gray-400">전월 대비 변화</span>
              <span
                className={`text-lg font-bold ${
                  Number(summary.comparison.expense_change_rate) > 0 ? 'text-red-400' : 'text-[#00d282]'
                }`}
              >
                {Number(summary.comparison.expense_change_rate) > 0 ? '+' : ''}
                {summary.comparison.expense_change_rate}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 카드별 사용 카드 */}
      {sortedCards.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#262932] bg-[#1c1e24] p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">카드별 사용</h2>
            <p className="mt-1 text-xs sm:text-[13px] text-gray-400">
              이번 달 카드 결제 합계 <strong className="font-semibold text-white">{formatMoney(totalCardExpense)}</strong>
              {' '}(전체 지출의 {summary.total_expense !== '0'
                ? ((totalCardExpense / Number(summary.total_expense)) * 100).toFixed(1)
                : '0'}%)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#262932] text-xs font-semibold text-gray-400">
                  <th className="pb-3 font-medium">카드</th>
                  <th className="pb-3 font-medium">유형</th>
                  <th className="pb-3 font-medium text-right">사용액</th>
                  <th className="pb-3 font-medium text-right">비중</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262932]/50">
                {sortedCards.map((c) => (
                  <tr key={c.card_id} className="transition-colors hover:bg-[#20222a]">
                    <td className="py-3 font-medium text-gray-200">
                      {c.card_name}
                      {c.last_four ? <span className="font-normal text-gray-500"> · {c.last_four}</span> : null}
                    </td>
                    <td className="py-3 text-xs text-gray-400">{CARD_TYPES[c.card_type] ?? c.card_type}</td>
                    <td className="py-3 text-right font-bold text-white">{formatMoney(c.amount)}</td>
                    <td className="py-3 text-right text-xs font-medium text-gray-400">{c.ratio}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

