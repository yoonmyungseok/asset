'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api/client';
import type { TrendPoint } from '@/types/api';
import { dedupeByChartDate, formatChartDate, formatMoney } from '@/lib/utils/format';

export type NetWorthTrendRange = '1M' | '3M' | '6M' | '1Y' | 'all';

const RANGE_OPTIONS: { key: NetWorthTrendRange; label: string }[] = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'all', label: '전체' },
];

const RANGE_DAYS: Record<Exclude<NetWorthTrendRange, 'all'>, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
};

const SERIES = [
  { key: 'net_worth' as const, label: '순자산', color: '#2563eb' },
  { key: 'total_assets' as const, label: '총자산', color: '#16a34a' },
  { key: 'total_liabilities' as const, label: '총부채', color: '#dc2626' },
];

type SeriesKey = (typeof SERIES)[number]['key'];

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeToQuery(range: NetWorthTrendRange): { from?: string; to?: string; range?: 'all' } {
  if (range === 'all') {
    return { range: 'all' };
  }
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - RANGE_DAYS[range]);
  return { from: toDateOnly(from), to: toDateOnly(to) };
}

type NetWorthTrendChartProps = {
  isMobile: boolean;
};

export function NetWorthTrendChart({ isMobile }: NetWorthTrendChartProps) {
  const [period, setPeriod] = useState<NetWorthTrendRange>('1M');
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    net_worth: true,
    total_assets: false,
    total_liabilities: false,
  });
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrend = useCallback(async (selected: NetWorthTrendRange) => {
    setLoading(true);
    try {
      const query = rangeToQuery(selected);
      const tr = await api.getNetWorthTrend(query.from, query.to, query.range);
      setTrend(dedupeByChartDate(tr.data, (point) => point.date));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrend(period);
  }, [period, loadTrend]);

  useEffect(() => {
    const handler = () => loadTrend(period);
    window.addEventListener('dashboard-refreshed', handler);
    return () => window.removeEventListener('dashboard-refreshed', handler);
  }, [period, loadTrend]);

  const toggleSeries = (key: SeriesKey) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="card">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h3 className="section-title mt-0">순자산 추이</h3>
        <div className="view-toggle w-fit">
          {RANGE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={period === key ? 'active' : ''}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="view-toggle mb-3 w-fit max-w-full flex-wrap">
        {SERIES.map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            className={`flex items-center gap-1.5 ${visible[key] ? 'active' : ''}`}
            onClick={() => toggleSeries(key)}
            aria-pressed={visible[key]}
            aria-label={label}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            {!isMobile && <span>{label}</span>}
          </button>
        ))}
      </div>

      <div className="chart-container">
        {loading ? (
          <div
            className="h-full w-full animate-pulse rounded-lg bg-gray-100"
            aria-busy="true"
            aria-label="차트 로딩 중"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatChartDate} />
              <YAxis tickFormatter={(v) => `${(Number(v) / 10000).toFixed(0)}만`} />
              <Tooltip formatter={(v) => formatMoney(v as number)} labelFormatter={formatChartDate} />
              {isMobile && <Legend />}
              {SERIES.map(({ key, label, color }) =>
                visible[key] ? (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={label}
                    stroke={color}
                    dot={false}
                  />
                ) : null,
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
