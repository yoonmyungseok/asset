'use client';

import { Bar, BarChart, ResponsiveContainer } from 'recharts';
import type { CashflowTrendPoint } from '@/types/api';
import {
  CHART_MARGIN,
  ChartCartesianGrid,
  ChartLineTooltip,
  ChartXAxis,
  ChartYAxis,
} from '@/components/charts/chart-ui';

type CashflowTrendChartProps = {
  data: CashflowTrendPoint[];
};

export function CashflowTrendChart({ data }: CashflowTrendChartProps) {
  return (
    <>
      <div className="chart-legend mb-2">
        <span className="chart-legend-item">
          <span className="chart-legend-swatch chart-legend-swatch--income" />
          수입
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-swatch chart-legend-swatch--expense" />
          지출
        </span>
      </div>
      <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={CHART_MARGIN} barCategoryGap="28%" barGap={6}>
          <defs>
            <linearGradient id="cashflow-income" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={1} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0.85} />
            </linearGradient>
            <linearGradient id="cashflow-expense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity={1} />
              <stop offset="100%" stopColor="#dc2626" stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <ChartCartesianGrid />
          <ChartXAxis
            dataKey="month"
            tickFormatter={(m, index) => {
              const year = data[index]?.year;
              return year ? `${year}.${m}` : String(m);
            }}
          />
          <ChartYAxis />
          <ChartLineTooltip />
          <Bar
            dataKey="income"
            name="수입"
            fill="url(#cashflow-income)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            dataKey="expense"
            name="지출"
            fill="url(#cashflow-expense)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
    </>
  );
}
