"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

function useChartLayout() {
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return {
    height: isMobile ? 220 : 280,
    tickFontSize: isMobile ? 10 : 12,
    xAxisInterval: isMobile ? ("preserveStartEnd" as const) : 0,
    tooltipStyle: {
      contentStyle: {
        fontSize: isMobile ? 13 : 12,
        padding: isMobile ? "10px 14px" : "8px 12px",
        borderRadius: 8,
        border: "none",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
      },
      labelStyle: {
        fontWeight: 600,
        marginBottom: 4,
        fontSize: isMobile ? 13 : 12,
      },
      itemStyle: {
        fontSize: isMobile ? 13 : 12,
        paddingTop: 2,
      },
    },
  };
}

interface WeightChartProps {
  data: { date: string; weight: number }[];
}

export function WeightChart({ data }: WeightChartProps) {
  const { height, tickFontSize, xAxisInterval, tooltipStyle } = useChartLayout();

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">표시할 데이터가 없습니다</p>;
  }

  const chartData = data.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "M/d"),
  }));

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: tickFontSize }}
            stroke="#94a3b8"
            interval={xAxisInterval}
            tickMargin={6}
          />
          <YAxis
            domain={["dataMin - 1", "dataMax + 1"]}
            tick={{ fontSize: tickFontSize }}
            stroke="#94a3b8"
            width={36}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)} kg`, "체중"]}
            labelFormatter={(label) => label}
            {...tooltipStyle}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3, fill: "#2563eb" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface RunningDistanceChartProps {
  data: { date: string; distance: number }[];
}

export function RunningDistanceChart({ data }: RunningDistanceChartProps) {
  const { height, tickFontSize, xAxisInterval, tooltipStyle } = useChartLayout();

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">표시할 데이터가 없습니다</p>;
  }

  const chartData = data.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "M/d"),
  }));

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: tickFontSize }}
            stroke="#94a3b8"
            interval={xAxisInterval}
            tickMargin={6}
          />
          <YAxis tick={{ fontSize: tickFontSize }} stroke="#94a3b8" width={36} />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)} km`, "거리"]}
            {...tooltipStyle}
          />
          <Bar dataKey="distance" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
