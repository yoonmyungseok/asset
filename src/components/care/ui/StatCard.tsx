import { getWeightTrendColorClass } from "@/lib/care/calculations/weight";

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  valueTrend?: "up" | "down" | "neutral";
}

export function StatCard({ label, value, subValue, trend, valueTrend }: StatCardProps) {
  const trendColor =
    trend === "up" ? "text-red-500" : trend === "down" ? "text-emerald-600" : "text-slate-500";
  const valueColor = getWeightTrendColorClass(valueTrend);

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-1 break-words text-xl font-bold sm:text-2xl ${valueTrend ? valueColor : "text-slate-900"}`}
      >
        {value}
      </p>
      {subValue && <p className={`mt-1 break-words text-sm ${trendColor}`}>{subValue}</p>}
    </div>
  );
}
