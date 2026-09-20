'use client';

import type { ReactNode } from 'react';

import type { DashboardOverview } from '@/types/api';

function formatInsightPercent(value: string): string {
  const num = Number(value);
  return `${num.toFixed(2)}%`;
}

function formatEmergencyMonths(value: string): string {
  const num = Number(value);
  return `${num.toFixed(1)}개월`;
}

function InsightValue({ children }: { children: ReactNode }) {
  return <div className="stat-value text-lg sm:text-xl">{children}</div>;
}

function EmptyInsight() {
  return <InsightValue>—</InsightValue>;
}

export function InsightCards({ overview }: { overview: DashboardOverview }) {
  const { insights } = overview;

  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card stat-card">
          <div className="stat-label">저축률</div>
          {insights.savings_rate != null ? (
            <InsightValue>{formatInsightPercent(insights.savings_rate)}</InsightValue>
          ) : (
            <EmptyInsight />
          )}
          <p className="text-muted mt-1 text-[13px]">이번 달 (수입 − 지출) ÷ 수입</p>
        </div>
        <div className="card stat-card">
          <div className="stat-label">비상자금</div>
          {insights.emergency_months != null ? (
            <InsightValue>{formatEmergencyMonths(insights.emergency_months)}</InsightValue>
          ) : (
            <EmptyInsight />
          )}
          <p className="text-muted mt-1 text-[13px]">
            입출금(cash) 계좌 합 ÷ 최근 6개월 월평균 지출
          </p>
        </div>
        <div className="card stat-card">
          <div className="stat-label">부채비율</div>
          {insights.debt_ratio != null ? (
            <InsightValue>{formatInsightPercent(insights.debt_ratio)}</InsightValue>
          ) : (
            <EmptyInsight />
          )}
          <p className="text-muted mt-1 text-[13px]">총부채 ÷ 총자산 × 100%</p>
        </div>
      </div>
    </div>
  );
}
