'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardOverview } from '@/types/api';
import { CATEGORY_LABELS, formatMoney, formatMoneyCompact } from '@/lib/utils/format';
import { ChartValueTooltip } from '@/components/charts/chart-ui';

const CATEGORY_ORDER = ['investment', 'pension', 'deposit', 'cash'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  investment: '#2563eb',
  pension: '#7c3aed',
  deposit: '#d97706',
  cash: '#16a34a',
};

const FALLBACK_COLORS = ['#0891b2', '#db2777', '#ca8a04', '#64748b'];

type AllocationSlice = {
  category: string;
  name: string;
  value: number;
};

export function aggregateAccountsByCategory(
  accounts: DashboardOverview['accounts_summary'],
): AllocationSlice[] {
  const sums = new Map<string, number>();
  for (const a of accounts) {
    const cat = a.category || 'other';
    sums.set(cat, (sums.get(cat) ?? 0) + Number(a.total_value));
  }

  const slices = [...sums.entries()]
    .filter(([, value]) => value > 0)
    .map(([category, value]) => ({
      category,
      name: CATEGORY_LABELS[category] || category,
      value,
    }));

  slices.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category as (typeof CATEGORY_ORDER)[number]);
    const bi = CATEGORY_ORDER.indexOf(b.category as (typeof CATEGORY_ORDER)[number]);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return b.value - a.value;
  });

  return slices;
}

function colorForCategory(category: string, index: number): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function buildCategorySummaryText(slices: AllocationSlice[], totalAssets: string): string {
  const total = Number(totalAssets);
  if (slices.length === 0 || total <= 0) return '표시할 자산 비중이 없습니다.';

  const ranked = [...slices].sort((a, b) => b.value - a.value);
  const top = ranked.slice(0, 2);
  return top
    .map((s) => {
      const pct = (s.value / total) * 100;
      return `${s.name} ${pct.toFixed(1)}%`;
    })
    .join(' / ');
}

type AssetAllocationChartProps = {
  accountsSummary: DashboardOverview['accounts_summary'];
  totalAssets: string;
  isMobile: boolean;
};

export function AssetAllocationChart({
  accountsSummary,
  totalAssets,
  isMobile,
}: AssetAllocationChartProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const slices = aggregateAccountsByCategory(accountsSummary);
  const summaryText = buildCategorySummaryText(slices, totalAssets);
  const total = Number(totalAssets);

  const chartData = slices.map((slice, i) => ({
    ...slice,
    color: colorForCategory(slice.category, i),
    ratio: total > 0 ? (slice.value / total) * 100 : 0,
  }));

  return (
    <div className="card">
      <h3 className="section-title mt-0">자산 비중</h3>
      <div className="allocation-chart-wrap">
        {slices.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted text-[13px]">
            계좌 데이터가 없습니다.
          </div>
        ) : (
          <>
            <div className="allocation-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? '52%' : '58%'}
                    outerRadius={isMobile ? '78%' : '82%'}
                    paddingAngle={3}
                    stroke="none"
                    onMouseEnter={(_, index) => setActiveCategory(chartData[index].category)}
                    onMouseLeave={() => setActiveCategory(null)}
                  >
                    {chartData.map((slice) => (
                      <Cell
                        key={slice.category}
                        fill={slice.color}
                        opacity={
                          activeCategory === null || activeCategory === slice.category ? 1 : 0.4
                        }
                        style={{ transition: 'opacity 0.2s ease' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartValueTooltip />} />
                  <text x="50%" y="46%" textAnchor="middle" className="allocation-donut-label">
                    총 자산
                  </text>
                  <text x="50%" y="56%" textAnchor="middle" className="allocation-donut-value">
                    {formatMoneyCompact(totalAssets)}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="allocation-legend">
              {chartData.map((slice) => {
                const isActive = activeCategory === slice.category;
                return (
                  <li
                    key={slice.category}
                    className={`allocation-legend-item${isActive ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveCategory(slice.category)}
                    onMouseLeave={() => setActiveCategory(null)}
                  >
                    <span className="allocation-legend-dot" style={{ backgroundColor: slice.color }} />
                    <span className="allocation-legend-name">{slice.name}</span>
                    <span className="allocation-legend-meta">
                      <span className="allocation-legend-pct">{slice.ratio.toFixed(1)}%</span>
                      <span className="allocation-legend-amount">{formatMoney(slice.value)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <p className="text-muted text-center text-[13px]">{summaryText}</p>
    </div>
  );
}
