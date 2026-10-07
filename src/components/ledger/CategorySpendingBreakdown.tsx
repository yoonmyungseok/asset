'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { LedgerSummary } from '@/types/api';
import { formatMoney } from '@/lib/utils/format';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

type CategoryItem = LedgerSummary['by_category'][number];

interface Props {
  categories: CategoryItem[];
  totalExpense: string;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number; ratio: number } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-[#2e323e] bg-[#1c1e24]/95 px-3.5 py-2.5 text-white shadow-xl backdrop-blur-md">
      <div className="text-xs font-semibold text-gray-200">{item.name}</div>
      <div className="text-sm font-bold text-white mt-0.5">{formatMoney(item.value)}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{item.ratio.toFixed(1)}%</div>
    </div>
  );
}

export default function CategorySpendingBreakdown({ categories, totalExpense }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sorted = [...categories]
    .filter((c) => Number(c.amount) > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount));

  const total = Number(totalExpense);
  const categoryColors = Object.fromEntries(
    sorted.map((c, i) => [c.category_id, COLORS[i % COLORS.length]]),
  );

  const chartData = sorted.map((c) => ({
    categoryId: c.category_id,
    name: c.category_name,
    value: Number(c.amount),
    ratio: total > 0 ? (Number(c.amount) / total) * 100 : 0,
    color: categoryColors[c.category_id],
  }));

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-[#262932] bg-[#1c1e24] p-6 mb-4 shadow-sm text-center">
        <h3 className="text-base font-bold text-white mb-2">카테고리별 지출</h3>
        <p className="text-xs text-gray-400">이번 달 지출 내역이 없습니다.</p>
      </div>
    );
  }

  const topCategory = sorted[0];

  return (
    <div className="rounded-2xl border border-[#262932] bg-[#1c1e24] p-5 lg:p-6 mb-4 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-white">카테고리별 지출</h2>
          <p className="mt-1 text-xs sm:text-[13px] text-gray-400">
            가장 많이 쓴 카테고리는 <strong className="font-semibold text-white">{topCategory.category_name}</strong>
            {' '}({topCategory.ratio}%)
          </p>
        </div>
        <div className="sm:text-right">
          <span className="text-xs text-gray-400 block mb-0.5">이번 달 지출</span>
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">{formatMoney(totalExpense)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(240px,300px)_1fr] lg:gap-8">
        <div className="relative mx-auto h-[200px] w-full max-w-[280px] lg:mx-0 lg:h-[260px] lg:max-w-none">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="50%"
                outerRadius="75%"
                paddingAngle={2}
                stroke="none"
                onMouseEnter={(_, index) => setActiveId(chartData[index].categoryId)}
                onMouseLeave={() => setActiveId(null)}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.categoryId}
                    fill={entry.color}
                    opacity={activeId === null || activeId === entry.categoryId ? 1 : 0.35}
                    style={{ transition: 'opacity 0.2s', outline: 'none' }}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <text x="50%" y="46%" textAnchor="middle" className="text-xs fill-gray-400 font-medium">
                총 지출
              </text>
              <text x="50%" y="56%" textAnchor="middle" className="text-lg font-bold fill-white">
                {total >= 10000 ? `${(total / 10000).toFixed(0)}만` : formatMoney(totalExpense)}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-1.5">
          {sorted.map((c, index) => {
            const color = categoryColors[c.category_id];
            const ratio = Number(c.ratio);
            const isActive = activeId === c.category_id;

            return (
              <div
                key={c.category_id}
                className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${
                  isActive ? 'bg-[#252834]' : 'hover:bg-[#20222a]'
                }`}
                onMouseEnter={() => setActiveId(c.category_id)}
                onMouseLeave={() => setActiveId(null)}
                onClick={() => setActiveId(activeId === c.category_id ? null : c.category_id)}
              >
                <div className="w-4 shrink-0 text-xs font-semibold leading-5 text-gray-500">{index + 1}</div>
                <div className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-200 truncate">{c.category_name}</span>
                    <span className="text-sm font-bold text-white whitespace-nowrap">{formatMoney(c.amount)}</span>
                  </div>
                  <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-[#282b36]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${ratio}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="flex justify-end text-[11px] font-medium text-gray-400">
                    <span>{ratio.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

