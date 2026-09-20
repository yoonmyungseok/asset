'use client';

import Link from 'next/link';
import type { AccountPerformance } from '@/types/api';
import { formatMoney, formatPercent } from '@/lib/utils/format';

/** Top 5: |평가손익| 내림차순 (동률 시 평가금액 내림차순) */
export function sortPerformanceForSnapshot(items: AccountPerformance[]): AccountPerformance[] {
  return [...items].sort((a, b) => {
    const plDiff = Math.abs(Number(b.profit_loss)) - Math.abs(Number(a.profit_loss));
    if (plDiff !== 0) return plDiff;
    return Number(b.market_value) - Number(a.market_value);
  });
}

export function aggregatePerformanceTotals(items: AccountPerformance[]): {
  profit_loss: number;
  profit_loss_rate: number | null;
} {
  let profitLoss = 0;
  let costBasis = 0;
  for (const row of items) {
    profitLoss += Number(row.profit_loss);
    costBasis += Number(row.cost_basis);
  }
  const profitLossRate = costBasis > 0 ? (profitLoss / costBasis) * 100 : null;
  return { profit_loss: profitLoss, profit_loss_rate: profitLossRate };
}

type InvestmentSnapshotProps = {
  items: AccountPerformance[] | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
};

export function InvestmentSnapshot({ items, loading, error, onRetry }: InvestmentSnapshotProps) {
  const top = items ? sortPerformanceForSnapshot(items).slice(0, 5) : [];
  const totals = items && items.length > 0 ? aggregatePerformanceTotals(items) : null;

  return (
    <div className="card">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="section-title mt-0">투자 성과</h3>
        <Link href="/investment" className="text-[13px] font-medium text-primary">
          자산 전체 보기
        </Link>
      </div>

      {loading ? (
        <div className="text-muted text-[13px]">로딩 중...</div>
      ) : error ? (
        <div className="empty-state py-4">
          <p className="text-muted mb-2">{error}</p>
          {onRetry ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>
              다시 시도
            </button>
          ) : null}
        </div>
      ) : !items || items.length === 0 ? (
        <p className="text-muted text-[13px] mb-0">표시할 투자 성과가 없습니다</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:max-w-md">
            <div>
              <div className="text-muted text-[13px]">평가손익 합계</div>
              <div
                className={`font-semibold ${
                  totals!.profit_loss >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatMoney(totals!.profit_loss)}
              </div>
            </div>
            {totals!.profit_loss_rate != null ? (
              <div>
                <div className="text-muted text-[13px]">합산 수익률</div>
                <div
                  className={`font-semibold ${
                    totals!.profit_loss_rate >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {formatPercent(totals!.profit_loss_rate)}
                </div>
              </div>
            ) : null}
          </div>

          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>계좌</th>
                  <th>평가손익</th>
                  <th>수익률</th>
                </tr>
              </thead>
              <tbody>
                {top.map((row) => {
                  const pl = Number(row.profit_loss);
                  const plClass = pl >= 0 ? 'text-success' : 'text-danger';
                  const rate = Number(row.profit_loss_rate);
                  const rateClass = rate >= 0 ? 'text-success' : 'text-danger';
                  return (
                    <tr key={row.account_id}>
                      <td>
                        <Link
                          href={`/investment/accounts/${row.account_id}`}
                          className="font-medium text-primary"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className={plClass}>{formatMoney(row.profit_loss)}</td>
                      <td className={rateClass}>{formatPercent(row.profit_loss_rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
