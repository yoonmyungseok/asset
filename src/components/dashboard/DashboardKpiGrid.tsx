'use client';

import type { DashboardOverview } from '@/types/api';
import { formatMoney, formatPercent } from '@/lib/utils/format';

function formatAsOf(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function DeltaSubline({
  amount,
  rate,
  positiveIsGood,
  label,
}: {
  amount: string;
  rate: string;
  positiveIsGood: boolean;
  label?: string;
}) {
  const amountNum = Number(amount);
  const rateNum = Number(rate);
  const isGood = positiveIsGood ? amountNum >= 0 : amountNum <= 0;
  const colorClass =
    amountNum === 0 && rateNum === 0 ? 'text-muted' : isGood ? 'text-success' : 'text-danger';
  const sign = amountNum > 0 ? '+' : '';

  return (
    <div className={`text-[13px] ${colorClass}`}>
      {label ? <span className="text-muted">{label} </span> : null}
      {sign}{formatMoney(amount)} ({formatPercent(rate)})
    </div>
  );
}

function RateSubline({
  rate,
  positiveIsGood,
  label = '전월 대비',
}: {
  rate: string;
  positiveIsGood: boolean;
  label?: string;
}) {
  const rateNum = Number(rate);
  const isGood = positiveIsGood ? rateNum <= 0 : rateNum >= 0;
  const colorClass = rateNum === 0 ? 'text-muted' : isGood ? 'text-success' : 'text-danger';
  const sign = rateNum > 0 ? '+' : '';

  return (
    <div className={`text-[13px] ${colorClass}`}>
      <span className="text-muted">{label} </span>
      {sign}{rate}%
    </div>
  );
}

function EmptySubline() {
  return <div className="text-muted text-[13px]">—</div>;
}

export function DashboardKpiGrid({ overview }: { overview: DashboardOverview }) {
  const comparison = overview.cashflow_comparison;
  const netDelta = overview.net_worth_delta;

  let cashflowNetRate: string | null = null;
  if (comparison) {
    const prevNet =
      Number(comparison.prev_month_income) - Number(comparison.prev_month_expense);
    const currentNet = Number(overview.cashflow.net);
    if (prevNet !== 0) {
      const rate = ((currentNet - prevNet) / prevNet) * 100;
      cashflowNetRate = rate.toFixed(2);
    } else {
      cashflowNetRate = '0.00';
    }
  }

  return (
    <div className="mb-4">
      <p className="text-muted mb-2 text-[13px]">기준: {formatAsOf(overview.as_of)}</p>
      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-label">총 순자산</div>
          <div className="stat-value">{formatMoney(overview.net_worth.net_worth)}</div>
          {netDelta ? (
            <DeltaSubline
              amount={netDelta.change_amount}
              rate={netDelta.change_rate}
              positiveIsGood
              label={`직전 스냅샷(${netDelta.previous_date.slice(0, 10).replace(/-/g, '.')})`}
            />
          ) : (
            <EmptySubline />
          )}
        </div>
        <div className="card stat-card">
          <div className="stat-label">이번 달 수입</div>
          <div className="stat-value text-success">{formatMoney(overview.cashflow.total_income)}</div>
          {comparison?.income_change_rate != null ? (
            <RateSubline rate={comparison.income_change_rate} positiveIsGood />
          ) : (
            <EmptySubline />
          )}
        </div>
        <div className="card stat-card">
          <div className="stat-label">이번 달 지출</div>
          <div className="stat-value text-danger">{formatMoney(overview.cashflow.total_expense)}</div>
          {comparison ? (
            <RateSubline rate={comparison.expense_change_rate} positiveIsGood={false} />
          ) : (
            <EmptySubline />
          )}
        </div>
        <div className="card stat-card">
          <div className="stat-label">현금흐름</div>
          <div
            className={`stat-value ${Number(overview.cashflow.net) >= 0 ? 'text-success' : 'text-danger'}`}
          >
            {Number(overview.cashflow.net) >= 0 ? '+' : ''}
            {formatMoney(overview.cashflow.net)}
          </div>
          {cashflowNetRate != null ? (
            <RateSubline rate={cashflowNetRate} positiveIsGood label="전월 순현금흐름 대비" />
          ) : (
            <EmptySubline />
          )}
        </div>
      </div>
    </div>
  );
}
