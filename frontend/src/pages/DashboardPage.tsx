import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client';
import { PageHeader } from '../components/layout/AppLayout';
import type { CashflowTrendPoint, DashboardOverview, TrendPoint } from '../types/api';
import { formatMoney, formatPercent } from '../utils/format';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6'];

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [cashflow, setCashflow] = useState<CashflowTrendPoint[]>([]);
  const [liabilities, setLiabilities] = useState<{ name: string; current_balance: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, tr, cf, liab] = await Promise.all([
        api.getDashboardOverview(),
        api.getNetWorthTrend(),
        api.getCashflowTrend(6),
        api.getLiabilities(),
      ]);
      setOverview(ov);
      setTrend(tr.data);
      setCashflow(cf.data);
      setLiabilities(liab);
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

  if (loading || !overview) return <div className="loading">로딩 중...</div>;

  const donutData = [
    { name: '투자', value: Number(overview.asset_breakdown.investment) },
    { name: '현금', value: Number(overview.asset_breakdown.cash) },
  ];

  const renderAssetLabel = ({ name, value }: { name: string; value: number }) =>
    `${name} ${formatMoney(value)}`;

  return (
    <>
      <PageHeader title="대시보드" />

      {overview.budget_alerts_count > 0 && (
        <div className="alert alert-warning">
          ⚠ 예산 초과 {overview.budget_alerts_count}건 — 가계부 &gt; 예산에서 확인하세요
        </div>
      )}
      {overview.limit_alerts.map((a) => (
        <div key={a.account_name} className="alert alert-warning">
          ⚠ {a.account_name} 한도 {a.usage_rate}% 사용 (잔여 {formatMoney(a.remaining)})
        </div>
      ))}

      <div className="card-grid card-grid-4" style={{ marginBottom: 16 }}>
        <div className="card stat-card">
          <div className="stat-label">총 순자산</div>
          <div className="stat-value">{formatMoney(overview.net_worth.net_worth)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">이번 달 수입</div>
          <div className="stat-value text-success">{formatMoney(overview.cashflow.total_income)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">이번 달 지출</div>
          <div className="stat-value text-danger">{formatMoney(overview.cashflow.total_expense)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">현금흐름</div>
          <div className={`stat-value ${Number(overview.cashflow.net) >= 0 ? 'text-success' : 'text-danger'}`}>
            {Number(overview.cashflow.net) >= 0 ? '+' : ''}{formatMoney(overview.cashflow.net)}
          </div>
        </div>
      </div>

      <div className="card-grid card-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 className="section-title" style={{ marginTop: 0 }}>순자산 추이 (30일)</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Line type="monotone" dataKey="net_worth" name="순자산" stroke="#2563eb" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3 className="section-title" style={{ marginTop: 0 }}>자산 비중</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderAssetLabel}>
                  {donutData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-muted" style={{ textAlign: 'center', fontSize: 13 }}>
            투자 {overview.asset_breakdown.investment_ratio}% / 현금 {overview.asset_breakdown.cash_ratio}%
          </p>
        </div>
      </div>

      <div className="card-grid card-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 className="section-title" style={{ marginTop: 0 }}>월별 현금흐름 (6개월)</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={(m, i) => `${cashflow[i]?.year}.${m}`} />
                <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Legend />
                <Bar dataKey="income" name="수입" fill="#16a34a" />
                <Bar dataKey="expense" name="지출" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3 className="section-title" style={{ marginTop: 0 }}>계좌별 breakdown</h3>
          <table className="table">
            <thead>
              <tr><th>계좌</th><th>유형</th><th>평가금액</th><th>비중</th></tr>
            </thead>
            <tbody>
              {overview.accounts_summary.map((a) => (
                <tr key={a.account_id}>
                  <td>{a.name}</td>
                  <td className="text-muted">{a.type}</td>
                  <td>{formatMoney(a.total_value)}</td>
                  <td>{a.ratio}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {liabilities.length > 0 && (
        <div className="card">
          <h3 className="section-title" style={{ marginTop: 0 }}>부채 요약</h3>
          <div style={{ display: 'flex', gap: 32 }}>
            {liabilities.map((l) => (
              <div key={l.name}>
                <div className="text-muted" style={{ fontSize: 13 }}>{l.name}</div>
                <div style={{ fontWeight: 600 }}>{formatMoney(l.current_balance)}</div>
              </div>
            ))}
            <div>
              <div className="text-muted" style={{ fontSize: 13 }}>총 부채</div>
              <div className="text-danger" style={{ fontWeight: 600 }}>
                {formatMoney(overview.net_worth.total_liabilities)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
