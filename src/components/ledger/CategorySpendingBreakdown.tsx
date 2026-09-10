'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { LedgerSummary } from '@/types/api';
import { formatMoney } from '@/lib/utils/format';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

type CategoryItem = LedgerSummary['by_category'][number];

interface Props {
  categories: CategoryItem[];
  totalExpense: string;
  monthQuery: string;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number; ratio: number } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="spending-tooltip">
      <div className="spending-tooltip-name">{item.name}</div>
      <div className="spending-tooltip-amount">{formatMoney(item.value)}</div>
      <div className="spending-tooltip-ratio">{item.ratio.toFixed(1)}%</div>
    </div>
  );
}

export default function CategorySpendingBreakdown({ categories, totalExpense, monthQuery }: Props) {
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

  const hasBudget = sorted.some((c) => c.budget);

  if (sorted.length === 0) {
    return (
      <div className="card spending-breakdown spending-breakdown--empty">
        <h3 className="section-title mt-0">카테고리별 지출</h3>
        <p className="text-muted">이번 달 지출 내역이 없습니다.</p>
      </div>
    );
  }

  const topCategory = sorted[0];

  return (
    <div className="card spending-breakdown">
      <div className="spending-breakdown-header">
        <div>
          <h3 className="section-title mt-0">카테고리별 지출</h3>
          <p className="spending-breakdown-subtitle">
            가장 많이 쓴 카테고리는 <strong>{topCategory.category_name}</strong>
            {' '}({topCategory.ratio}%)
          </p>
        </div>
        <div className="spending-breakdown-total">
          <span className="spending-breakdown-total-label">이번 달 지출</span>
          <span className="spending-breakdown-total-value">{formatMoney(totalExpense)}</span>
        </div>
      </div>

      <div className="spending-breakdown-body">
        <div className="spending-breakdown-chart">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={72}
                outerRadius={108}
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
                    style={{ transition: 'opacity 0.2s' }}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <text x="50%" y="46%" textAnchor="middle" className="spending-donut-label">
                총 지출
              </text>
              <text x="50%" y="56%" textAnchor="middle" className="spending-donut-value">
                {total >= 10000 ? `${(total / 10000).toFixed(0)}만` : formatMoney(totalExpense)}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="spending-breakdown-list">
          {sorted.map((c, index) => {
            const color = categoryColors[c.category_id];
            const ratio = Number(c.ratio);
            const budgetRate = c.budget ? (Number(c.amount) / Number(c.budget) * 100) : 0;
            const isActive = activeId === c.category_id;

            return (
              <div
                key={c.category_id}
                className={`spending-row${isActive ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveId(c.category_id)}
                onMouseLeave={() => setActiveId(null)}
              >
                <div className="spending-row-rank">{index + 1}</div>
                <div className="spending-row-color" style={{ backgroundColor: color }} />
                <div className="spending-row-content">
                  <div className="spending-row-top">
                    <span className="spending-row-name">{c.category_name}</span>
                    <span className="spending-row-amount">{formatMoney(c.amount)}</span>
                  </div>
                  <div className="spending-row-bar-track">
                    <div
                      className="spending-row-bar-fill"
                      style={{ width: `${ratio}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="spending-row-meta">
                    <span>{ratio.toFixed(1)}%</span>
                    {c.budget ? (
                      <span className={c.over_budget ? 'text-danger' : budgetRate >= 90 ? 'text-warning' : ''}>
                        예산 {budgetRate.toFixed(0)}%
                        {c.over_budget ? ' · 초과' : ''}
                      </span>
                    ) : (
                      <span className="text-muted">예산 미설정</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasBudget && (
        <div className="spending-budget-note">
          예산 사용률은 해당 월·카테고리에 설정한 예산 대비 지출 비율입니다.
          {' '}<Link href={`/ledger/budget${monthQuery}`}>예산 관리</Link>
        </div>
      )}
    </div>
  );
}
