import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import CategorySpendingBreakdown from '../components/ledger/CategorySpendingBreakdown';
import { PageHeader } from '../components/layout/AppLayout';
import MonthNavigator from '../components/ledger/MonthNavigator';
import { useLedgerMonth } from '../hooks/useLedgerMonth';
import type { LedgerSummary } from '../types/api';
import { CARD_TYPES, formatMoney } from '../utils/format';

export default function LedgerAnalysisPage() {
  const { year, month, monthQuery } = useLedgerMonth();
  const [summary, setSummary] = useState<LedgerSummary | null>(null);

  useEffect(() => {
    api.getLedgerSummary(year, month).then(setSummary);
  }, [year, month]);

  if (!summary) return <div className="loading">로딩 중...</div>;

  const sortedCards = [...summary.by_card].sort(
    (a, b) => Number(b.amount) - Number(a.amount),
  );
  const totalCardExpense = sortedCards.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <>
      <PageHeader
        title="가계부 분석"
        actions={<Link to={`/ledger${monthQuery}`} className="btn btn-secondary">← 거래목록</Link>}
      />

      <div className="filters">
        <MonthNavigator />
      </div>

      <CategorySpendingBreakdown
        categories={summary.by_category}
        totalExpense={summary.total_expense}
        monthQuery={monthQuery}
      />

      {summary.comparison && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>전월 대비</h3>
          <p>
            이번 달 지출: <strong>{formatMoney(summary.total_expense)}</strong>
            {' | '}전월: {formatMoney(summary.comparison.prev_month_expense)}
            {' | '}변화: <strong className={Number(summary.comparison.expense_change_rate) > 0 ? 'text-danger' : 'text-success'}>
              {Number(summary.comparison.expense_change_rate) > 0 ? '+' : ''}{summary.comparison.expense_change_rate}%
            </strong>
          </p>
        </div>
      )}

      {sortedCards.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>카드별 사용</h3>
          <p className="text-muted" style={{ marginTop: -8, marginBottom: 16, fontSize: 13 }}>
            이번 달 카드 결제 합계 <strong>{formatMoney(totalCardExpense)}</strong>
            {' '}(전체 지출의 {summary.total_expense !== '0'
              ? ((totalCardExpense / Number(summary.total_expense)) * 100).toFixed(1)
              : '0'}%)
          </p>
          <table className="table">
            <thead>
              <tr><th>카드</th><th>유형</th><th>사용액</th><th>비중</th></tr>
            </thead>
            <tbody>
              {sortedCards.map((c) => (
                <tr key={c.card_id}>
                  <td>
                    {c.card_name}
                    {c.last_four ? <span className="text-muted"> · {c.last_four}</span> : null}
                  </td>
                  <td className="text-muted">{CARD_TYPES[c.card_type] ?? c.card_type}</td>
                  <td>{formatMoney(c.amount)}</td>
                  <td>{c.ratio}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
