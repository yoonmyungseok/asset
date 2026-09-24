import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/care/services/settings";
import { getRestDayTypeSet, getRunningTypes } from "@/lib/care/services/running-types";
import { calculateWeightStats, getWeightChartData, buildWeightDayChanges } from "@/lib/care/calculations/weight";
import { calculateAveragePace, sumDistance, isActiveRun } from "@/lib/care/calculations/running";
import { calculateNutritionSummary } from "@/lib/care/calculations/diet";
import { formatDate, todayString } from "@/lib/care/utils";

export async function getDashboardData() {
  const today = todayString();
  const settings = await getSettings();

  const [weightRecords, runningRecords, todayMeals, restDayTypes, runningTypes] = await Promise.all([
    prisma.weightRecord.findMany({ orderBy: { date: "desc" } }),
    prisma.runningRecord.findMany({ orderBy: { date: "desc" } }),
    prisma.meal.findMany({
      where: { date: today },
      include: { foodEntries: true },
    }),
    getRestDayTypeSet(),
    getRunningTypes(),
  ]);

  const weightStats = calculateWeightStats(
    weightRecords,
    settings.targetWeight,
    today,
  );

  const now = new Date();
  const weekStart = formatDate(startOfWeek(now, { weekStartsOn: 1 }));
  const weekEnd = formatDate(endOfWeek(now, { weekStartsOn: 1 }));
  const monthStart = formatDate(startOfMonth(now));
  const monthEnd = formatDate(endOfMonth(now));

  const weekRuns = runningRecords.filter(
    (r) => r.date >= weekStart && r.date <= weekEnd,
  );
  const monthRuns = runningRecords.filter(
    (r) => r.date >= monthStart && r.date <= monthEnd,
  );

  const last30Start = formatDate(subDays(now, 29));
  const last30Runs = runningRecords.filter((r) => r.date >= last30Start);

  const todayFoodEntries = todayMeals.flatMap((m) => m.foodEntries);
  const nutrition = calculateNutritionSummary(todayFoodEntries, settings);

  const runningChartData = aggregateRunningByDate(last30Runs, last30Start, today, restDayTypes);
  const weightChartData = getWeightChartData(weightRecords, 30, today);
  const dayChanges = buildWeightDayChanges(weightRecords);

  return {
    targets: {
      targetCalories: settings.targetCalories,
      targetCarbs: settings.targetCarbs,
      targetProtein: settings.targetProtein,
      targetFat: settings.targetFat,
    },
    weight: weightStats,
    running: {
      weekDistance: sumDistance(weekRuns, restDayTypes),
      monthDistance: sumDistance(monthRuns, restDayTypes),
      recentAveragePace: calculateAveragePace(runningRecords.slice(0, 10), restDayTypes),
      totalCount: runningRecords.length,
      chartData: runningChartData,
      recentRecords: runningRecords.slice(0, 5),
    },
    diet: nutrition,
    weightChartData,
    recentWeightRecords: weightRecords.slice(0, 5).map((record) => ({
      ...record,
      changeFromPrevious: dayChanges.get(record.date) ?? null,
    })),
    todayMeals,
    runningTypes: runningTypes.map(({ value, label, excludeFromStats }) => ({
      value,
      label,
      excludeFromStats,
    })),
  };
}

function aggregateRunningByDate(
  records: { date: string; distance: number; type?: string }[],
  startDate: string,
  endDate: string,
  restDayTypes: Set<string>,
): { date: string; distance: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!isActiveRun(r, restDayTypes)) continue;
    map.set(r.date, (map.get(r.date) ?? 0) + r.distance);
  }

  const result: { date: string; distance: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    result.push({ date: dateStr, distance: map.get(dateStr) ?? 0 });
  }
  return result;
}
