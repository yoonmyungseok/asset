'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DashboardOverview } from '@/types/api';
import { formatMoney } from '@/lib/utils/format';

const VISIBLE_MAX = 3;

function limitFillClass(usageRate: string): string {
  const n = Number(usageRate);
  if (n >= 100) return ' over';
  if (n >= 90) return ' near';
  return '';
}

function ExpandToggle({
  total,
  expanded,
  onToggle,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (total <= VISIBLE_MAX) return null;
  return (
    <button type="button" className="btn btn-link text-[13px] p-0 min-h-0" onClick={onToggle}>
      {expanded ? '접기' : `외 ${total - VISIBLE_MAX}건 더보기`}
    </button>
  );
}

export function DashboardAlerts({ overview }: { overview: DashboardOverview }) {
  const { budget_alerts, limit_alerts, cashflow } = overview;
  const budgetHref = `/ledger/budget?year=${cashflow.year}&month=${cashflow.month}`;

  const hasBudget = budget_alerts.length > 0;
  const hasLimits = limit_alerts.length > 0;
  if (!hasBudget && !hasLimits) return null;

  const alertCount = budget_alerts.length + limit_alerts.length;
  const [panelOpen, setPanelOpen] = useState(true);
  const [budgetExpanded, setBudgetExpanded] = useState(false);
  const [limitExpanded, setLimitExpanded] = useState(false);

  const visibleBudget = budgetExpanded ? budget_alerts : budget_alerts.slice(0, VISIBLE_MAX);
  const visibleLimits = limitExpanded ? limit_alerts : limit_alerts.slice(0, VISIBLE_MAX);

  return (
    <div className="alert alert-warning mb-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left font-medium"
        onClick={() => setPanelOpen((v) => !v)}
        aria-expanded={panelOpen}
      >
        <span>⚠ 알림 {alertCount}건</span>
        <span className="text-[13px] font-normal text-amber-900/80">{panelOpen ? '접기' : '펼치기'}</span>
      </button>

      {panelOpen && (
        <div className="mt-3 space-y-4 border-t border-amber-200/80 pt-3">
          {hasBudget && (
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[13px] font-semibold m-0">
                  예산 초과 ({budget_alerts.length}건)
                </h3>
                <Link href={budgetHref} className="text-[13px] underline underline-offset-2">
                  예산 관리
                </Link>
              </div>
              <ul className="m-0 list-none space-y-2 p-0">
                {visibleBudget.map((item) => (
                  <li key={item.category_name} className="text-[13px] leading-snug">
                    <span className="font-medium">{item.category_name}</span>
                    <span className="text-amber-900/90">
                      {' '}
                      — 예산 {formatMoney(item.budget)}, 사용 {formatMoney(item.spent)}
                      {item.over_amount != null && (
                        <span className="text-danger"> (초과 {formatMoney(item.over_amount)})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <ExpandToggle
                total={budget_alerts.length}
                expanded={budgetExpanded}
                onToggle={() => setBudgetExpanded((v) => !v)}
              />
            </section>
          )}

          {hasLimits && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold m-0">
                연간 한도 ({limit_alerts.length}건)
              </h3>
              <ul className="m-0 list-none space-y-3 p-0">
                {visibleLimits.map((item) => (
                  <li key={item.account_name}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[13px]">
                      <span className="font-medium">{item.account_name}</span>
                      <span>
                        {item.usage_rate}% · 잔여 {formatMoney(item.remaining)}
                      </span>
                    </div>
                    <div className="progress-bar mt-1">
                      <div
                        className={`progress-bar-fill${limitFillClass(item.usage_rate)}`}
                        style={{ width: `${Math.min(Number(item.usage_rate), 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <ExpandToggle
                total={limit_alerts.length}
                expanded={limitExpanded}
                onToggle={() => setLimitExpanded((v) => !v)}
              />
            </section>
          )}
        </div>
      )}

      {!panelOpen && alertCount > 0 && (
        <p className="mt-2 mb-0 text-[13px] text-amber-900/80">
          {hasBudget && `예산 초과 ${budget_alerts.length}건`}
          {hasBudget && hasLimits && ' · '}
          {hasLimits && `한도 알림 ${limit_alerts.length}건`}
        </p>
      )}
    </div>
  );
}
