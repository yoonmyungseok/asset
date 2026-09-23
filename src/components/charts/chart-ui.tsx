'use client';

import {
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { formatChartDate, formatMoney } from '@/lib/utils/format';

export const CHART_MARGIN = { top: 12, right: 12, left: 4, bottom: 4 };

const AXIS_TICK_STYLE = { fill: '#94a3b8', fontSize: 12 };

export function ChartCartesianGrid() {
  return (
    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 6" />
  );
}

type ChartXAxisProps = {
  dataKey: string;
  tickFormatter?: (value: string, index: number) => string;
};

export function ChartXAxis({
  dataKey,
  tickFormatter = (value) => formatChartDate(value),
}: ChartXAxisProps) {
  return (
    <XAxis
      dataKey={dataKey}
      axisLine={false}
      tickLine={false}
      tick={AXIS_TICK_STYLE}
      tickMargin={10}
      tickFormatter={tickFormatter}
      minTickGap={24}
    />
  );
}

type ChartYAxisProps = {
  tickFormatter?: (value: number) => string;
  width?: number;
};

export function formatChartAxisWon(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (abs >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return new Intl.NumberFormat('ko-KR').format(Math.round(n));
}

export function ChartYAxis({
  tickFormatter = formatChartAxisWon,
  width = 52,
}: ChartYAxisProps) {
  return (
    <YAxis
      axisLine={false}
      tickLine={false}
      tick={AXIS_TICK_STYLE}
      tickFormatter={tickFormatter}
      width={width}
    />
  );
}

type ChartTooltipRow = {
  name?: string;
  value?: number | string;
  color?: string;
};

type ChartValueTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipRow[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
};

export function ChartValueTooltip({
  active,
  payload,
  label,
  labelFormatter = (value) => formatChartDate(value),
  valueFormatter = (v) => formatMoney(v),
}: ChartValueTooltipProps) {
  if (!active || !payload?.length) return null;

  const rows = payload.filter(
    (entry: ChartTooltipRow) => entry.value != null && entry.value !== '',
  );

  if (rows.length === 0) return null;

  const title = label != null && label !== '' ? labelFormatter(String(label)) : null;

  return (
    <div className="chart-tooltip">
      {title ? <div className="chart-tooltip-label">{title}</div> : null}
      <div className="chart-tooltip-rows">
        {rows.map((row) => (
          <div key={String(row.name)} className="chart-tooltip-row">
            <span className="chart-tooltip-dot" style={{ backgroundColor: row.color }} />
            <span className="chart-tooltip-name">{row.name}</span>
            <span className="chart-tooltip-value">
              {valueFormatter(Number(row.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ChartTooltipOptions = Pick<ChartValueTooltipProps, 'labelFormatter' | 'valueFormatter'>;

export function ChartTooltip(options?: ChartTooltipOptions) {
  return (
    <Tooltip
      content={<ChartValueTooltip {...options} />}
      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
    />
  );
}

export function ChartLineTooltip(options?: ChartTooltipOptions) {
  return (
    <Tooltip
      content={<ChartValueTooltip {...options} />}
      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
    />
  );
}

export const CHART_SERIES = {
  primary: '#2563eb',
  success: '#16a34a',
  danger: '#dc2626',
  violet: '#7c3aed',
  amber: '#d97706',
} as const;

export function lineGradientId(key: string): string {
  return `line-gradient-${key}`;
}

export function LineAreaGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.22} />
      <stop offset="95%" stopColor={color} stopOpacity={0.02} />
    </linearGradient>
  );
}

export const LINE_ACTIVE_DOT = {
  r: 5,
  strokeWidth: 2,
  stroke: '#fff',
  fill: CHART_SERIES.primary,
};
