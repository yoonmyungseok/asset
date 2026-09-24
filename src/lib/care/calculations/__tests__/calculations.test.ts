import { describe, it, expect } from "vitest";
import {
  calculatePaceSeconds,
  formatPace,
  formatPaceColon,
  formatDistanceKm,
  calculateAveragePace,
  sumDistance,
  countRecords,
  findLongestRun,
  formatDistanceChange,
} from "@/lib/care/calculations/running";
import { calculateWeightStats, formatWeightChange, buildWeightDayChanges, getWeightChangeClassName, getWeightChangeTrend } from "@/lib/care/calculations/weight";
import {
  sumNutrition,
  calculateNutritionSummary,
  calculateProgress,
  scaleNutrition,
  formatConsumptionDisplay,
  deriveQuantityFromEntry,
} from "@/lib/care/calculations/diet";
import {
  calculateBMR,
  calculateNutritionGoals,
  calculateTDEE,
} from "@/lib/care/calculations/nutrition-goals";

describe("running calculations", () => {
  it("calculates pace from distance and duration", () => {
    const pace = calculatePaceSeconds(10, 55 * 60);
    expect(pace).toBeCloseTo(330, 0);
    expect(formatPace(pace)).toBe(`5'30"/km`);
  });

  it("returns null for zero distance", () => {
    expect(calculatePaceSeconds(0, 3600)).toBeNull();
  });

  it("returns null for zero duration", () => {
    expect(calculatePaceSeconds(10, 0)).toBeNull();
  });

  it("formats pace correctly", () => {
    expect(formatPace(330)).toBe(`5'30"/km`);
    expect(formatPace(null)).toBe("-");
    expect(formatPace(0)).toBe("-");
  });

  it("calculates average pace across records", () => {
    const records = [
      { distance: 10, durationSeconds: 3300 },
      { distance: 5, durationSeconds: 1500 },
    ];
    const avg = calculateAveragePace(records);
    expect(avg).toBeCloseTo(320, 0);
  });

  it("sums distance", () => {
    expect(sumDistance([{ distance: 5 }, { distance: 10 }])).toBe(15);
    expect(sumDistance([{ distance: 5, type: "easy" }, { distance: 0, type: "rest" }])).toBe(5);
  });

  it("excludes rest days from average pace and longest run", () => {
    const records = [
      { distance: 10, durationSeconds: 3300, type: "easy" },
      { distance: 0, durationSeconds: 0, type: "rest" },
    ];
    expect(calculateAveragePace(records)).toBeCloseTo(330, 0);
    expect(findLongestRun([{ date: "2026-09-01", distance: 0, type: "rest" }])).toBeNull();
  });

  it("counts records in date range", () => {
    const records = [
      { date: "2026-09-01", distance: 5 },
      { date: "2026-09-03", distance: 3 },
      { date: "2026-09-05", distance: 10 },
    ];
    expect(countRecords(records, "2026-09-01", "2026-09-05")).toBe(3);
    expect(countRecords(records, "2026-09-02", "2026-09-04")).toBe(1);
  });

  it("excludes rest days from run count", () => {
    const restDayTypes = new Set(["rest"]);
    const records = [
      { date: "2026-09-14", distance: 0, type: "rest" },
      { date: "2026-09-13", distance: 8, type: "easy" },
    ];
    expect(countRecords(records, "2026-09-14", "2026-09-14", restDayTypes)).toBe(0);
    expect(countRecords(records, "2026-09-13", "2026-09-14", restDayTypes)).toBe(1);
  });

  it("finds longest run", () => {
    const records = [
      { date: "2026-08-01", distance: 8 },
      { date: "2026-08-23", distance: 9.5 },
      { date: "2026-09-01", distance: 5 },
    ];
    expect(findLongestRun(records)).toEqual({ date: "2026-08-23", distance: 9.5 });
    expect(findLongestRun([])).toBeNull();
  });

  it("formats distance change", () => {
    expect(formatDistanceChange(3.2)).toBe("+3.2 km");
    expect(formatDistanceChange(-1.5)).toBe("-1.5 km");
    expect(formatDistanceChange(0)).toBe("0 km");
  });

  it("formats pace in colon style", () => {
    expect(formatPaceColon(474)).toBe("7:54");
    expect(formatPaceColon(null)).toBe("-");
  });

  it("formats distance for copy output", () => {
    expect(formatDistanceKm(5)).toBe("5km");
    expect(formatDistanceKm(10.5)).toBe("10.5km");
  });
});

describe("weight calculations", () => {
  const records = [
    { date: "2026-01-01", weight: 75.0 },
    { date: "2026-01-15", weight: 73.5 },
    { date: "2026-01-30", weight: 72.0 },
    { date: "2026-02-01", weight: 71.5 },
  ];

  it("calculates current weight and changes", () => {
    const stats = calculateWeightStats(records, 68.0, "2026-02-01");
    expect(stats.current).toBe(71.5);
    expect(stats.changeFromFirst).toBeCloseTo(-3.5, 1);
    expect(stats.remainingToTarget).toBeCloseTo(-3.5, 1);
  });

  it("formats weight change with sign", () => {
    expect(formatWeightChange(-1.5)).toBe("-1.5 kg");
    expect(formatWeightChange(2.0)).toBe("+2.0 kg");
    expect(formatWeightChange(null)).toBe("-");
  });

  it("maps weight change to trend and styles", () => {
    expect(getWeightChangeTrend(0.3)).toBe("up");
    expect(getWeightChangeTrend(-0.3)).toBe("down");
    expect(getWeightChangeTrend(0)).toBe("neutral");
    expect(getWeightChangeClassName(0.3)).toContain("text-red-600");
    expect(getWeightChangeClassName(-0.3)).toContain("text-emerald-700");
  });

  it("builds day-over-day changes", () => {
    const changes = buildWeightDayChanges(records);
    expect(changes.get("2026-01-01")).toBeNull();
    expect(changes.get("2026-01-15")).toBeCloseTo(-1.5, 1);
    expect(changes.get("2026-02-01")).toBeCloseTo(-0.5, 1);
  });

  it("compares latest record to the immediately previous entry", () => {
    const recentRecords = [
      { date: "2026-09-04", weight: 75.4 },
      { date: "2026-09-05", weight: 75.5 },
    ];
    const stats = calculateWeightStats(recentRecords, 68, "2026-09-05");
    expect(stats.changeFromPrevious).toBeCloseTo(0.1, 1);
  });

  it("returns null stats for empty records", () => {
    const stats = calculateWeightStats([], 70);
    expect(stats.current).toBeNull();
  });
});

describe("diet calculations", () => {
  const entries = [
    { calories: 300, carbs: 40, protein: 20, fat: 10 },
    { calories: 500, carbs: 60, protein: 30, fat: 15 },
    { calories: 200, carbs: 25, protein: 10, fat: 8 },
  ];

  it("sums nutrition values", () => {
    const total = sumNutrition(entries);
    expect(total.calories).toBe(1000);
    expect(total.carbs).toBe(125);
    expect(total.protein).toBe(60);
    expect(total.fat).toBe(33);
  });

  it("calculates progress percentage", () => {
    expect(calculateProgress(500, 1000)).toBe(50);
    expect(calculateProgress(1200, 1000)).toBe(100);
    expect(calculateProgress(0, 0)).toBe(0);
  });

  it("calculates nutrition summary with targets", () => {
    const summary = calculateNutritionSummary(entries, {
      targetCalories: 2000,
      targetCarbs: 250,
      targetProtein: 120,
      targetFat: 65,
    });

    expect(summary.calories).toBe(1000);
    expect(summary.remainingCalories).toBe(1000);
    expect(summary.calorieProgress).toBe(50);
    expect(summary.carbsProgress).toBe(50);
    expect(summary.proteinProgress).toBe(50);
    expect(summary.fatProgress).toBeCloseTo(50.77, 1);
  });

  it("scales nutrition by quantity", () => {
    const base = { calories: 78, carbs: 0.6, protein: 6.3, fat: 5.3, sodium: 62 };
    const scaled = scaleNutrition(base, 3);
    expect(scaled.calories).toBeCloseTo(234, 0);
    expect(scaled.protein).toBeCloseTo(18.9, 1);
    expect(scaled.sodium).toBeCloseTo(186, 0);
  });

  it("formats consumption as standardAmount × quantity", () => {
    expect(formatConsumptionDisplay(3, "1개(50g)")).toBe("1개(50g) × 3");
    expect(formatConsumptionDisplay(2, "130g")).toBe("130g × 2");
  });

  it("derives quantity from stored entry macros", () => {
    const foodItem = { calories: 78, carbs: 0.6, protein: 6.3, fat: 5.3 };
    const entry = { calories: 234, carbs: 1.8, protein: 18.9, fat: 15.9 };
    expect(deriveQuantityFromEntry(entry, foodItem)).toBe(3);
  });
});

describe("nutrition goals calculations", () => {
  const profile = {
    birthYear: 1993,
    gender: "male" as const,
    heightCm: 176,
    weightKg: 70,
    activityLevel: "moderate" as const,
  };

  it("calculates BMR for 1993 male 176cm 70kg", () => {
    const bmr = calculateBMR(profile);
    expect(bmr).toBeCloseTo(1640, 0);
  });

  it("calculates TDEE with moderate activity", () => {
    const tdee = calculateTDEE(profile);
    expect(tdee).toBeCloseTo(2542, 0);
  });

  it("calculates macro targets from profile", () => {
    const goals = calculateNutritionGoals(profile);
    expect(goals.targetCalories).toBeCloseTo(2542, 0);
    expect(goals.targetProtein).toBe(126);
    expect(goals.targetFat).toBe(71);
    expect(goals.targetCarbs).toBeGreaterThan(0);
  });
});
