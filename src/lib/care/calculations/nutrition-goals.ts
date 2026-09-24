export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface NutritionProfile {
  birthYear: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

export interface NutritionGoals {
  targetCalories: number;
  targetCarbs: number;
  targetProtein: number;
  targetFat: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateAge(
  birthYear: number,
  referenceYear: number = new Date().getFullYear(),
): number {
  return referenceYear - birthYear;
}

/** Mifflin-St Jeor BMR formula */
export function calculateBMR(profile: NutritionProfile): number {
  const age = calculateAge(profile.birthYear);
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age;

  if (profile.gender === "male") {
    return base + 5;
  }
  return base - 161;
}

export function calculateTDEE(profile: NutritionProfile): number {
  const bmr = calculateBMR(profile);
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel];
  return Math.round(bmr * multiplier);
}

/** Protein 1.8g/kg, fat 25% of calories, carbs fill the remainder */
export function calculateMacroTargets(tdee: number, weightKg: number): NutritionGoals {
  const targetProtein = Math.round(weightKg * 1.8);
  const targetFat = Math.round((tdee * 0.25) / 9);
  const proteinCalories = targetProtein * 4;
  const fatCalories = targetFat * 9;
  const carbCalories = Math.max(tdee - proteinCalories - fatCalories, 0);
  const targetCarbs = Math.round(carbCalories / 4);

  return {
    targetCalories: tdee,
    targetCarbs,
    targetProtein,
    targetFat,
  };
}

export function calculateNutritionGoals(profile: NutritionProfile): NutritionGoals {
  const tdee = calculateTDEE(profile);
  return calculateMacroTargets(tdee, profile.weightKg);
}
