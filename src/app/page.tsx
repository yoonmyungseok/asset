'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/AppLayout';
import { AssetAllocationChart } from '@/components/dashboard/AssetAllocationChart';
import { DashboardKpiGrid } from '@/components/dashboard/DashboardKpiGrid';
import { InsightCards } from '@/components/dashboard/InsightCards';
import { InvestmentSnapshot } from '@/components/dashboard/InvestmentSnapshot';
import { DashboardAlerts } from '@/components/dashboard/DashboardAlerts';
import { NetWorthTrendChart } from '@/components/dashboard/NetWorthTrendChart';
import { CashflowTrendChart } from '@/components/dashboard/CashflowTrendChart';
import type { AccountPerformance, CashflowTrendPoint, DashboardOverview } from '@/types/api';
import { formatMoney } from '@/lib/utils/format';
import { CareDashboardSection } from '@/components/care/CareDashboardSection';

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [cashflow, setCashflow] = useState<CashflowTrendPoint[]>([]);
  const [liabilities, setLiabilities] = useState<{ name: string; current_balance: string }[]>([]);
  const [performance, setPerformance] = useState<AccountPerformance[] | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const load = async () => {
    setLoading(true);
    setPerformanceLoading(true);
    setPerformanceError(null);
    try {
      const [ov, cf, liab, perf] = await Promise.all([
        api.getDashboardOverview(),
        api.getCashflowTrend(6),
        api.getLiabilities(),
        api.getAccountPerformance().catch((e) => {
          setPerformanceError(
            e instanceof Error ? e.message : '투자 성과를 불러오지 못했습니다.',
          );
          setPerformance(null);
          return null;
        }),
      ]);
      setOverview(ov);
      setCashflow(cf.data);
      setLiabilities(liab);
      if (perf) setPerformance(perf);
    } finally {
      setLoading(false);
      setPerformanceLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('dashboard-refreshed', handler);
    return () => window.removeEventListener('dashboard-refreshed', handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (loading || !overview) return <div className="loading">로딩 중...</div>;

  return (
    <>
      <PageHeader title="대시보드" />

      <DashboardAlerts overview={overview} />

      <DashboardKpiGrid overview={overview} />

      <InsightCards overview={overview} />

      <div className="card-grid card-grid-2 mb-4">
        <NetWorthTrendChart />
        <AssetAllocationChart
          accountsSummary={overview.accounts_summary}
          totalAssets={overview.net_worth.total_assets}
          isMobile={isMobile}
        />
      </div>

      <div className="card-grid card-grid-2 mb-4">
        <div className="card">
          <h3 className="section-title mt-0">월별 현금흐름 (6개월)</h3>
          <CashflowTrendChart data={cashflow} />
        </div>
        <div className="card">
          <h3 className="section-title mt-0">계좌별 breakdown</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>계좌</th><th>유형</th><th>평가금액</th><th>비중</th></tr>
              </thead>
              <tbody>
                {overview.accounts_summary.map((a) => (
                  <tr key={a.account_id}>
                    <td>
                      <Link href={`/investment/accounts/${a.account_id}`} className="font-medium text-primary">
                        {a.name}
                      </Link>
                    </td>
                    <td className="text-muted">{a.type}</td>
                    <td>{formatMoney(a.total_value)}</td>
                    <td>{a.ratio}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <InvestmentSnapshot
          items={performance}
          loading={performanceLoading}
          error={performanceError}
          onRetry={load}
        />
      </div>

      {liabilities.length > 0 && (
        <div className="card">
          <h3 className="section-title mt-0">부채 요약</h3>
          <div className="grid grid-cols-2 gap-4 lg:flex lg:gap-8">
            {liabilities.map((l) => (
              <div key={l.name}>
                <div className="text-muted text-[13px]">{l.name}</div>
                <div className="font-semibold">{formatMoney(l.current_balance)}</div>
              </div>
            ))}
            <div>
              <div className="text-muted text-[13px]">총 부채</div>
              <div className="text-danger font-semibold">
                {formatMoney(overview.net_worth.total_liabilities)}
              </div>
            </div>
          </div>
        </div>
      )}

      <CareDashboardSection />
    </>
  );
}
