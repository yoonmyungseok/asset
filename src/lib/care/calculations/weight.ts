import { format, parseISO, subDays } from "date-fns";

export interface WeightRecordLike {
  date: string;
  weight: number;
}

export interface WeightStats {
  current: number | null;
  changeFromPrevious: number | null;
  changeFromFirst: number | null;
  change7Days: number | null;
  change30Days: number | null;
  targetWeight: number;
  remainingToTarget: number | null;
}

function findRecordOnOrBefore(
  records: WeightRecordLike[],
  targetDate: string,
): WeightRecordLike | null {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.find((r) => r.date <= targetDate) ?? null;
}

export function calculateWeightStats(
  records: WeightRecordLike[],
  targetWeight: number,
  referenceDate: string = format(new Date(), "yyyy-MM-dd"),
): WeightStats {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0] ?? null;

  if (!latest) {
    return {
      current: null,
      changeFromPrevious: null,
      changeFromFirst: null,
      change7Days: null,
      change30Days: null,
      targetWeight,
      remainingToTarget: null,
    };
  }

  const dayChanges = buildWeightDayChanges(records);
  const first = [...records].sort((a, b) => a.date.localeCompare(b.date))[0];

  const date7DaysAgo = format(subDays(parseISO(referenceDate), 7), "yyyy-MM-dd");
  const date30DaysAgo = format(subDays(parseISO(referenceDate), 30), "yyyy-MM-dd");

  const record7DaysAgo = findRecordOnOrBefore(records, date7DaysAgo);
  const record30DaysAgo = findRecordOnOrBefore(records, date30DaysAgo);

  return {
    current: latest.weight,
    changeFromPrevious: dayChanges.get(latest.date) ?? null,
    changeFromFirst: first ? latest.weight - first.weight : null,
    change7Days: record7DaysAgo
      ? latest.weight - record7DaysAgo.weight
      : null,
    change30Days: record30DaysAgo
      ? latest.weight - record30DaysAgo.weight
      : null,
    targetWeight,
    remainingToTarget: targetWeight - latest.weight,
  };
}

export function formatWeightChange(change: number | null): string {
  if (change == null) return "-";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)} kg`;
}

export type WeightChangeTrend = "up" | "down" | "neutral";

export function getWeightChangeTrend(
  change: number | null,
): WeightChangeTrend | undefined {
  if (change == null) return undefined;
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "neutral";
}

export function getWeightChangeClassName(change: number | null): string {
  const trend = getWeightChangeTrend(change);
  if (trend === "up") return "text-red-600 bg-red-50";
  if (trend === "down") return "text-emerald-700 bg-emerald-50";
  return "text-slate-900";
}

export function getWeightTrendColorClass(
  trend: WeightChangeTrend | undefined,
): string {
  if (trend === "up") return "text-red-600";
  if (trend === "down") return "text-emerald-600";
  return "text-slate-900";
}

export function buildWeightDayChanges(
  records: WeightRecordLike[],
): Map<string, number | null> {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const changes = new Map<string, number | null>();

  for (let i = 0; i < sorted.length; i++) {
    changes.set(
      sorted[i].date,
      i === 0 ? null : sorted[i].weight - sorted[i - 1].weight,
    );
  }

  return changes;
}

export function getWeightChartData(
  records: WeightRecordLike[],
  days: number = 30,
  referenceDate: string = format(new Date(), "yyyy-MM-dd"),
): { date: string; weight: number }[] {
  const startDate = format(subDays(parseISO(referenceDate), days - 1), "yyyy-MM-dd");

  return [...records]
    .filter((r) => r.date >= startDate && r.date <= referenceDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, weight: r.weight }));
}
