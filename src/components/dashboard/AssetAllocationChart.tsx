'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DashboardOverview } from '@/types/api';
import { CATEGORY_LABELS, formatMoney } from '@/lib/utils/format';

const CATEGORY_ORDER = ['investment', 'pension', 'deposit', 'cash'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  investment: '#2563eb',
  pension: '#8b5cf6',
  deposit: '#d97706',
  cash: '#16a34a',
};

const FALLBACK_COLORS = ['#dc2626', '#0891b2', '#ca8a04', '#4b5563'];

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
  const slices = aggregateAccountsByCategory(accountsSummary);
  const summaryText = buildCategorySummaryText(slices, totalAssets);

  const renderLabel = ({ name, value }: { name?: string; value?: number }) =>
    `${name ?? ''} ${formatMoney(value ?? 0)}`;

  return (
    <div className="card">
      <h3 className="section-title mt-0">자산 비중</h3>
      <div className="chart-container">
        {slices.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted text-[13px]">
            계좌 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={isMobile ? 75 : 100}
                label={isMobile ? false : renderLabel}
              >
                {slices.map((slice, i) => (
                  <Cell key={slice.category} fill={colorForCategory(slice.category, i)} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatMoney(v as number)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-muted text-center text-[13px]">{summaryText}</p>
    </div>
  );
}
