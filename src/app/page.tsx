'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ComposedChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/AppLayout';
import type { CashflowTrendPoint, DashboardOverview, TrendPoint } from '@/types/api';
import { CATEGORY_LABELS, formatMoney } from '@/lib/utils/format';

const ASSET_COLORS = { investment: '#2563eb', cash: '#16a34a' };
const NET_WORTH_GREEN = '#22c55e';
const NET_WORTH_LINE = '#15803d';
const LIABILITY_GRAY = '#e5e7eb';
const CATEGORY_COLORS: Record<string, string> = {
  investment: '#2563eb',
  pension: '#8b5cf6',
  deposit: '#d97706',
  cash: '#16a34a',
};
const CHART_CURSOR = { fill: 'rgba(15, 23, 42, 0.04)' };
const CHART_DOT = { r: 4, fill: '#fff', stroke: NET_WORTH_LINE, strokeWidth: 2 };
const CHART_TOOLTIP_PROPS = {
  cursor: CHART_CURSOR,
  isAnimationActive: false,
  animationDuration: 0,
} as const;

function StatIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="dashboard-stat-icon" aria-hidden>
      {children}
    </span>
  );
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint & { label: string; assets: number; liabilities: number; netWorth: number } }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{point.year}년 {point.label}</div>
      <div className="chart-tooltip-row">자산 {formatMoney(point.assets)}</div>
      <div className="chart-tooltip-row">부채 {formatMoney(point.liabilities)}</div>
      <div className="chart-tooltip-highlight">순자산 {formatMoney(point.netWorth)}</div>
    </div>
  );
}

function CashflowTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="chart-tooltip-row" style={{ color: entry.color }}>
          {entry.name} {formatMoney(entry.value)}
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [cashflow, setCashflow] = useState<CashflowTrendPoint[]>([]);
  const [liabilities, setLiabilities] = useState<{ name: string; current_balance: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [netWorthView, setNetWorthView] = useState<'trend' | 'composition'>('trend');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, tr, cf, liab] = await Promise.all([
        api.getDashboardOverview(),
        api.getNetWorthTrend(12),
        api.getCashflowTrend(6),
        api.getLiabilities(),
      ]);
      setOverview(ov);
      setTrend(tr.data);
      setCashflow(cf.data);
      setLiabilities(liab);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('dashboard-refreshed', handler);
    return () => window.removeEventListener('dashboard-refreshed', handler);
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="대시보드" />
        <div className="dashboard-skeleton">
          <div className="dashboard-skeleton-hero" />
          <div className="dashboard-skeleton-grid">
            {[0, 1, 2, 3].map((i) => <div key={i} className="dashboard-skeleton-card" />)}
          </div>
        </div>
      </>
    );
  }

  if (error || !overview) {
    return (
      <>
        <PageHeader title="대시보드" />
        <div className="empty-state card">
          <h3>데이터를 불러오지 못했습니다</h3>
          <p>{error ?? '알 수 없는 오류가 발생했습니다.'}</p>
          <button type="button" className="btn btn-primary" onClick={load}>다시 시도</button>
        </div>
      </>
    );
  }

  const netCashflow = Number(overview.cashflow.net);
  const donutData = [
    { key: 'investment', name: '투자', value: Number(overview.asset_breakdown.investment), ratio: Number(overview.asset_breakdown.investment_ratio), color: ASSET_COLORS.investment },
    { key: 'cash', name: '현금', value: Number(overview.asset_breakdown.cash), ratio: Number(overview.asset_breakdown.cash_ratio), color: ASSET_COLORS.cash },
  ];

  const trendChartData = trend.map((point) => ({
    ...point,
    label: `${point.month}월`,
    assets: Number(point.total_assets),
    liabilities: Number(point.total_liabilities),
    netWorth: Number(point.net_worth),
  }));

  const formatTrendMonthTick = (value: string, index: number) => {
    const isLast = index === trendChartData.length - 1;
    const showLabel = isLast || index % 3 === 0;
    if (!showLabel) return '';
    return value;
  };

  const cashflowChartData = cashflow.map((point) => ({
    ...point,
    label: `${point.year}.${point.month}`,
    income: Number(point.income),
    expense: Number(point.expense),
  }));

  const sortedAccounts = [...overview.accounts_summary]
    .filter((a) => Number(a.total_value) > 0)
    .sort((a, b) => Number(b.total_value) - Number(a.total_value));

  const asOfDate = new Date(overview.as_of);
  const asOfLabel = `${asOfDate.getFullYear()}.${String(asOfDate.getMonth() + 1).padStart(2, '0')}.${String(asOfDate.getDate()).padStart(2, '0')} 기준`;

  return (
    <>
      <PageHeader title="대시보드" />

      {(overview.budget_alerts_count > 0 || overview.limit_alerts.length > 0) && (
        <div className="mb-4">
          {overview.budget_alerts_count > 0 && (
            <div className="dashboard-alert alert-warning">
              <span className="dashboard-alert-icon">⚠</span>
              <div className="dashboard-alert-content">
                <div>예산 초과 {overview.budget_alerts_count}건이 있습니다.</div>
                <Link href="/ledger/budget" className="dashboard-alert-link">예산 관리에서 확인 →</Link>
              </div>
            </div>
          )}
          {overview.limit_alerts.map((a) => (
            <div key={a.account_name} className="dashboard-alert alert-warning">
              <span className="dashboard-alert-icon">⚠</span>
              <div className="dashboard-alert-content">
                <div>{a.account_name} 한도 {a.usage_rate}% 사용 (잔여 {formatMoney(a.remaining)})</div>
                <Link href="/investment" className="dashboard-alert-link">자산 페이지에서 확인 →</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-hero">
        <div className="dashboard-hero-header">
          <div>
            <div className="net-worth-card-title">총 순자산</div>
            <div className="net-worth-card-value">{formatMoney(overview.net_worth.net_worth)}</div>
            <div className="dashboard-hero-meta">
              <span>자산 <strong>{formatMoney(overview.net_worth.total_assets)}</strong></span>
              <span>부채 <strong className="text-danger">{formatMoney(overview.net_worth.total_liabilities)}</strong></span>
              <span>{asOfLabel}</span>
            </div>
          </div>
          <div className="view-toggle shrink-0">
            <button
              type="button"
              className={netWorthView === 'trend' ? 'active' : ''}
              onClick={() => setNetWorthView('trend')}
            >
              추이
            </button>
            <button
              type="button"
              className={netWorthView === 'composition' ? 'active' : ''}
              onClick={() => setNetWorthView('composition')}
            >
              구성
            </button>
          </div>
        </div>

        {netWorthView === 'trend' ? (
          <>
            <div className="dashboard-legend">
              <span className="dashboard-legend-item">
                <span className="dashboard-legend-dot" style={{ background: NET_WORTH_GREEN }} />
                자산
              </span>
              <span className="dashboard-legend-item">
                <span className="dashboard-legend-dot" style={{ background: LIABILITY_GRAY }} />
                부채
              </span>
              <span className="dashboard-legend-item">
                <span
                  className="dashboard-legend-line"
                  style={{ borderColor: NET_WORTH_LINE }}
                />
                순자산
              </span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendChartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tick={({ x, y, index }) => {
                      const point = trendChartData[index];
                      if (!point) return null;
                      const label = formatTrendMonthTick(point.label, index);
                      if (!label) return null;
                      const isLast = index === trendChartData.length - 1;
                      return (
                        <text
                          x={x}
                          y={Number(y) + 14}
                          textAnchor="middle"
                          fill={isLast ? NET_WORTH_GREEN : '#9ca3af'}
                          fontSize={12}
                        >
                          {label}
                        </text>
                      );
                    }}
                  />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip content={<TrendTooltip />} {...CHART_TOOLTIP_PROPS} />
                  <Bar dataKey="assets" name="자산" fill={NET_WORTH_GREEN} radius={[6, 6, 0, 0]} barSize={28} activeBar={false} isAnimationActive={false} />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    name="순자산"
                    stroke={NET_WORTH_LINE}
                    strokeWidth={2}
                    dot={CHART_DOT}
                    activeDot={CHART_DOT}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="dashboard-composition">
            <div className="dashboard-composition-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="63%"
                    outerRadius="80%"
                    paddingAngle={3}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="dashboard-donut-center">
                <span className="dashboard-donut-center-label">총 자산</span>
                <span className="dashboard-donut-center-value">
                  {formatMoney(overview.net_worth.total_assets)}
                </span>
              </div>
            </div>
            <div className="spending-breakdown-list">
              {donutData.map((item) => (
                <div key={item.key} className="spending-row">
                  <div className="spending-row-color" style={{ backgroundColor: item.color }} />
                  <div className="spending-row-content">
                    <div className="spending-row-top">
                      <span className="spending-row-name">{item.name}</span>
                      <span className="spending-row-amount">{formatMoney(item.value)}</span>
                    </div>
                    <div className="spending-row-bar-track">
                      <div
                        className="spending-row-bar-fill"
                        style={{ width: `${item.ratio}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <div className="spending-row-meta">
                      <span>{item.ratio.toFixed(1)}%</span>
                      <span className="text-muted">전체 자산 대비</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="stat-grid mb-4">
        <div className="dashboard-stat dashboard-stat--assets">
          <div className="dashboard-stat-top">
            <span className="dashboard-stat-label">총 자산</span>
            <StatIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </StatIcon>
          </div>
          <div className="dashboard-stat-value">{formatMoney(overview.net_worth.total_assets)}</div>
        </div>
        <div className="dashboard-stat dashboard-stat--income">
          <div className="dashboard-stat-top">
            <span className="dashboard-stat-label">이번 달 수입</span>
            <StatIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
            </StatIcon>
          </div>
          <div className="dashboard-stat-value text-success">{formatMoney(overview.cashflow.total_income)}</div>
        </div>
        <div className="dashboard-stat dashboard-stat--expense">
          <div className="dashboard-stat-top">
            <span className="dashboard-stat-label">이번 달 지출</span>
            <StatIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </StatIcon>
          </div>
          <div className="dashboard-stat-value text-danger">{formatMoney(overview.cashflow.total_expense)}</div>
        </div>
        <div className="dashboard-stat dashboard-stat--cashflow">
          <div className="dashboard-stat-top">
            <span className="dashboard-stat-label">현금흐름</span>
            <StatIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
            </StatIcon>
          </div>
          <div className={`dashboard-stat-value ${netCashflow >= 0 ? 'text-success' : 'text-danger'}`}>
            {netCashflow >= 0 ? '+' : ''}{formatMoney(overview.cashflow.net)}
          </div>
        </div>
      </div>

      <div className="card-grid card-grid-2 mb-4">
        <div className="card">
          <h3 className="section-title mt-0">월별 현금흐름</h3>
          <p className="mb-4 -mt-2 text-[13px] text-gray-500">최근 6개월 수입·지출 비교</p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowChartData} barGap={4} barCategoryGap="20%">
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(v) => `${(Number(v) / 10000).toFixed(0)}만`}
                  width={42}
                />
                <Tooltip
                  {...CHART_TOOLTIP_PROPS}
                  content={({ active, payload, label }) => (
                    <CashflowTooltip
                      active={active}
                      payload={payload?.map((p) => ({
                        name: p.name ?? '',
                        value: Number(p.value),
                        color: p.color ?? '#666',
                      }))}
                      label={String(label)}
                    />
                  )}
                />
                <Bar dataKey="income" name="수입" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={32} activeBar={false} isAnimationActive={false} />
                <Bar dataKey="expense" name="지출" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={32} activeBar={false} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex justify-center gap-5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-600" />
              수입
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-600" />
              지출
            </span>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="section-title mt-0">계좌별 구성</h3>
              <p className="-mt-2 text-[13px] text-gray-500">
                상위 {Math.min(sortedAccounts.length, 8)}개 계좌 · 총 {overview.accounts_summary.length}개
              </p>
            </div>
            <Link href="/investment" className="shrink-0 text-[13px] font-medium text-primary">
              전체 보기 →
            </Link>
          </div>
          <div className="dashboard-account-list">
            {sortedAccounts.slice(0, 8).map((account) => {
              const ratio = Number(account.ratio);
              const color = CATEGORY_COLORS[account.category] ?? '#64748b';
              return (
                <Link
                  key={account.account_id}
                  href={`/investment/accounts/${account.account_id}`}
                  className="dashboard-account-row"
                >
                  <span className="dashboard-account-dot" style={{ backgroundColor: color }} />
                  <div className="dashboard-account-content">
                    <div className="dashboard-account-top">
                      <span className="dashboard-account-name">{account.name}</span>
                      <span className="dashboard-account-value">{formatMoney(account.total_value)}</span>
                    </div>
                    <div className="dashboard-account-bar-track">
                      <div
                        className="dashboard-account-bar-fill"
                        style={{ width: `${Math.max(ratio, 0.5)}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="dashboard-account-meta">
                      <span>{CATEGORY_LABELS[account.category] ?? account.type}</span>
                      <span>{ratio.toFixed(1)}%</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {liabilities.length > 0 && (
        <div className="card">
          <h3 className="section-title mt-0">부채 요약</h3>
          <div className="dashboard-liability-grid">
            {liabilities.map((l) => (
              <div key={l.name} className="dashboard-liability-item">
                <div className="text-muted mb-1 text-[13px]">{l.name}</div>
                <div className="font-semibold">{formatMoney(l.current_balance)}</div>
              </div>
            ))}
            <div className="dashboard-liability-item dashboard-liability-total">
              <div className="text-muted mb-1 text-[13px]">총 부채</div>
              <div className="text-danger font-bold">
                {formatMoney(overview.net_worth.total_liabilities)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
