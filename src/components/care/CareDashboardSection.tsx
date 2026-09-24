"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/care/ui/Card";
import { StatCard } from "@/components/care/ui/StatCard";
import { ProgressBar } from "@/components/care/ui/ProgressBar";
import { LoadingSpinner } from "@/components/care/ui/Loading";
import { WeightChart, RunningDistanceChart } from "@/components/care/charts/Charts";
import { formatWeightChange, getWeightChangeClassName, getWeightChangeTrend } from "@/lib/care/calculations/weight";
import { formatPace } from "@/lib/care/calculations/running";
import { formatDisplayDate } from "@/lib/care/utils";
import { getRunningTypeLabel, getMealTypeLabel, isRestDay } from "@/lib/care/constants";
interface DashboardData {
  weight: {
    current: number | null;
    changeFromPrevious: number | null;
    change7Days: number | null;
    change30Days: number | null;
    targetWeight: number;
    remainingToTarget: number | null;
  };
  running: {
    weekDistance: number;
    monthDistance: number;
    recentAveragePace: number | null;
    chartData: { date: string; distance: number }[];
    recentRecords: {
      id: number;
      date: string;
      type: string;
      distance: number;
      avgPaceSeconds: number | null;
    }[];
  };
  targets: {
    targetCalories: number;
    targetCarbs: number;
    targetProtein: number;
    targetFat: number;
  };
  diet: {
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
    remainingCalories: number;
    calorieProgress: number;
    carbsProgress: number;
    proteinProgress: number;
    fatProgress: number;
  };
  weightChartData: { date: string; weight: number }[];
  recentWeightRecords: {
    id: number;
    date: string;
    weight: number;
    changeFromPrevious: number | null;
  }[];
  todayMeals: {
    id: number;
    mealType: string;
    foodEntries: { id: number; foodName: string; calories: number }[];
  }[];
  runningTypes: {
    value: string;
    label: string;
    excludeFromStats: boolean;
  }[];
}

export function CareDashboardSection() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error(`dashboard ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (active) setData(json);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  if (!data) {
    return (
      <p className="text-center text-slate-500">데이터를 불러올 수 없습니다</p>
    );
  }

  const typeOptions = data.runningTypes.map(({ value, label }) => ({ value, label }));
  const restDayValues = data.runningTypes
    .filter((t) => t.excludeFromStats)
    .map((t) => t.value);

  return (
    <div className="mb-8 border-t border-gray-200 pt-8">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">건강</h2>
        <p className="text-sm text-slate-500">체중·러닝·식단 요약</p>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          오늘의 요약
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="현재 체중"
            value={data.weight.current != null ? `${data.weight.current.toFixed(1)} kg` : "-"}
            subValue={
              data.weight.changeFromPrevious != null
                ? `전일 ${formatWeightChange(data.weight.changeFromPrevious)}`
                : formatWeightChange(data.weight.change7Days) + " (7일)"
            }
            trend={
              data.weight.changeFromPrevious != null
                ? getWeightChangeTrend(data.weight.changeFromPrevious)
                : data.weight.change7Days != null
                  ? data.weight.change7Days > 0
                    ? "up"
                    : data.weight.change7Days < 0
                      ? "down"
                      : "neutral"
                  : undefined
            }
            valueTrend={getWeightChangeTrend(data.weight.changeFromPrevious)}
          />
          <StatCard
            label="목표 체중"
            value={`${data.weight.targetWeight.toFixed(1)} kg`}
            subValue={
              data.weight.remainingToTarget != null
                ? `${data.weight.remainingToTarget > 0 ? "+" : ""}${data.weight.remainingToTarget.toFixed(1)} kg`
                : "-"
            }
          />
          <StatCard
            label="오늘 칼로리"
            value={`${data.diet.calories.toFixed(0)} kcal`}
            subValue={`남은 ${data.diet.remainingCalories.toFixed(0)} kcal`}
          />
          <StatCard
            label="목표 칼로리"
            value={`${data.targets.targetCalories.toFixed(0)} kcal`}
            subValue={`${data.diet.calorieProgress.toFixed(0)}% 달성`}
          />
          <StatCard
            label="이번 주 러닝"
            value={`${data.running.weekDistance.toFixed(1)} km`}
            subValue={`이번 달 ${data.running.monthDistance.toFixed(1)} km`}
          />
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="체중 변화 (최근 30일)">
          <div className="h-[220px] sm:h-[280px] [&_.recharts-responsive-container]:!h-full">
            <WeightChart data={data.weightChartData} />
          </div>
        </Card>
        <Card title="러닝 거리 (최근 30일)">
          <div className="h-[220px] sm:h-[280px] [&_.recharts-responsive-container]:!h-full">
            <RunningDistanceChart data={data.running.chartData} />
          </div>
        </Card>
      </div>

      <Card title="오늘의 영양소" className="mb-6">
        <div className="space-y-4">
          <ProgressBar
            label="칼로리"
            current={data.diet.calories}
            target={data.targets.targetCalories}
            unit=" kcal"
            color="bg-orange-500"
          />
          <ProgressBar
            label="탄수화물"
            current={data.diet.carbs}
            target={data.targets.targetCarbs}
            color="bg-amber-500"
          />
          <ProgressBar
            label="단백질"
            current={data.diet.protein}
            target={data.targets.targetProtein}
            color="bg-emerald-500"
          />
          <ProgressBar
            label="지방"
            current={data.diet.fat}
            target={data.targets.targetFat}
            color="bg-rose-500"
          />
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          최근 기록
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title="최근 체중">
            {data.recentWeightRecords.length === 0 ? (
              <p className="text-sm text-slate-500">기록이 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {data.recentWeightRecords.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                  >
                    <span className="shrink-0 text-slate-500">{formatDisplayDate(r.date)}</span>
                    <span
                      className={`break-words rounded-md px-2 py-0.5 font-medium sm:text-right ${getWeightChangeClassName(r.changeFromPrevious)}`}
                    >
                      {r.weight.toFixed(1)} kg
                      {r.changeFromPrevious != null && (
                        <span className="ml-1.5 text-xs font-normal opacity-80">
                          {formatWeightChange(r.changeFromPrevious)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="최근 러닝">
            {data.running.recentRecords.length === 0 ? (
              <p className="text-sm text-slate-500">기록이 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {data.running.recentRecords.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-2"
                  >
                    <span className="min-w-0 break-words">
                      <span className="text-slate-500">{formatDisplayDate(r.date)}</span>
                      <span className="ml-2 text-slate-400">
                        {getRunningTypeLabel(r.type, typeOptions)}
                      </span>
                    </span>
                    <span className="break-words font-medium sm:shrink-0 sm:text-right">
                      {isRestDay(r.type, restDayValues)
                        ? getRunningTypeLabel(r.type, typeOptions)
                        : `${r.distance.toFixed(1)} km · ${formatPace(r.avgPaceSeconds)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="오늘 식단">
            {data.todayMeals.length === 0 ? (
              <p className="text-sm text-slate-500">오늘 기록된 식단이 없습니다</p>
            ) : (
              <ul className="space-y-3">
                {data.todayMeals.map((meal) => (
                  <li key={meal.id}>
                    <p className="text-xs font-semibold text-slate-500">
                      {getMealTypeLabel(meal.mealType)}
                    </p>
                    {meal.foodEntries.map((f) => (
                      <div
                        key={f.id}
                        className="flex flex-col gap-0.5 text-sm sm:flex-row sm:justify-between sm:gap-2"
                      >
                        <span className="min-w-0 break-words">{f.foodName}</span>
                        <span className="shrink-0 text-slate-500 sm:text-right">
                          {f.calories.toFixed(0)} kcal
                        </span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
