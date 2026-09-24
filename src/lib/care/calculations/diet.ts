export interface NutritionEntry {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export interface NutritionTargets {
  targetCalories: number;
  targetCarbs: number;
  targetProtein: number;
  targetFat: number;
}

export interface NutritionSummary extends NutritionEntry {
  remainingCalories: number;
  calorieProgress: number;
  carbsProgress: number;
  proteinProgress: number;
  fatProgress: number;
}

export function sumNutrition(entries: NutritionEntry[]): NutritionEntry {
  return entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + (entry.calories || 0),
      carbs: acc.carbs + (entry.carbs || 0),
      protein: acc.protein + (entry.protein || 0),
      fat: acc.fat + (entry.fat || 0),
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  );
}

export function calculateProgress(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.min((current / target) * 100, 100);
}

export function calculateNutritionSummary(
  entries: NutritionEntry[],
  targets: NutritionTargets,
): NutritionSummary {
  const totals = sumNutrition(entries);

  return {
    ...totals,
    remainingCalories: targets.targetCalories - totals.calories,
    calorieProgress: calculateProgress(totals.calories, targets.targetCalories),
    carbsProgress: calculateProgress(totals.carbs, targets.targetCarbs),
    proteinProgress: calculateProgress(totals.protein, targets.targetProtein),
    fatProgress: calculateProgress(totals.fat, targets.targetFat),
  };
}

export function scaleNutrition(
  base: NutritionEntry & { sodium?: number | null },
  quantity: number,
  standardAmount: number = 1,
): NutritionEntry & { sodium: number } {
  const ratio = quantity / standardAmount;
  return {
    calories: base.calories * ratio,
    carbs: base.carbs * ratio,
    protein: base.protein * ratio,
    fat: base.fat * ratio,
    sodium: (base.sodium ?? 0) * ratio,
  };
}

export function formatConsumptionDisplay(
  quantity: number,
  standardAmount: string,
): string {
  return `${standardAmount} × ${quantity}`;
}

export function deriveQuantityFromEntry(
  entry: NutritionEntry,
  foodItem: NutritionEntry,
): number {
  if (foodItem.calories <= 0) return 1;
  const ratio = entry.calories / foodItem.calories;
  return Math.round(ratio * 100) / 100;
}
