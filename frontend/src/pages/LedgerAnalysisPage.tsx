import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api/client';
import { PageHeader } from '../components/layout/AppLayout';
import type { LedgerSummary } from '../types/api';
import { currentYearMonth, formatMoney } from '../utils/format';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function LedgerAnalysisPage() {
  const { year, month } = currentYearMonth();
  const [summary, setSummary] = useState<LedgerSummary | null>(null);

  useEffect(() => {
    api.getLedgerSummary(year, month).then(setSummary);
  }, [year, month]);

  if (!summary) return <div className="loading">로딩 중...</div>;

  const pieData = summary.by_category.map((c) => ({
    name: c.category_name,
    value: Number(c.amount),
  }));

  return (
    <>
      <PageHeader
        title="가계부 분석"
        actions={<Link to="/ledger" className="btn btn-secondary">← 거래목록</Link>}
      />

      <p className="text-muted" style={{ marginBottom: 16 }}>{year}년 {month}월</p>

      <div className="card-grid card-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 className="section-title" style={{ marginTop: 0 }}>카테고리별 지출 (파이)</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3 className="section-title" style={{ marginTop: 0 }}>카테고리별 지출 (막대)</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={pieData} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

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

      <div className="card">
        <h3 className="section-title" style={{ marginTop: 0 }}>카테고리별 상세 + 예산</h3>
        <table className="table">
          <thead>
            <tr><th>카테고리</th><th>지출</th><th>예산</th><th>사용률</th></tr>
          </thead>
          <tbody>
            {summary.by_category.map((c) => {
              const rate = c.budget ? (Number(c.amount) / Number(c.budget) * 100) : 0;
              return (
                <tr key={c.category_id}>
                  <td>{c.category_name}</td>
                  <td>{formatMoney(c.amount)}</td>
                  <td>{c.budget ? formatMoney(c.budget) : '—'}</td>
                  <td>
                    {c.budget ? (
                      <>
                        <div className="progress-bar">
                          <div
                            className={`progress-bar-fill${c.over_budget ? ' over' : rate >= 90 ? ' near' : ''}`}
                            style={{ width: `${Math.min(rate, 100)}%` }}
                          />
                        </div>
                        <span className={c.over_budget ? 'text-danger' : ''}>{rate.toFixed(0)}%</span>
                      </>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
