import { prisma } from "@/lib/db";
import {
  calculateNutritionGoals,
  type ActivityLevel,
  type Gender,
} from "@/lib/care/calculations/nutrition-goals";
import type { UserSettings } from "@prisma/client";

const DEFAULT_SETTINGS = {
  targetWeight: 70.0,
  birthYear: 1993,
  gender: "male",
  heightCm: 176.0,
  activityLevel: "moderate",
  targetCalories: 2000.0,
  targetCarbs: 250.0,
  targetProtein: 120.0,
  targetFat: 65.0,
};

async function getLatestWeight(): Promise<number | null> {
  const record = await prisma.weightRecord.findFirst({
    orderBy: { date: "desc" },
    select: { weight: true },
  });
  return record?.weight ?? null;
}

function computeGoals(settings: UserSettings, weightKg: number) {
  return calculateNutritionGoals({
    birthYear: settings.birthYear,
    gender: settings.gender as Gender,
    heightCm: settings.heightCm,
    weightKg,
    activityLevel: settings.activityLevel as ActivityLevel,
  });
}

export async function getSettings(): Promise<UserSettings> {
  let settings = await prisma.userSettings.findFirst();
  if (!settings) {
    settings = await prisma.userSettings.create({ data: DEFAULT_SETTINGS });
  }

  const weightKg = (await getLatestWeight()) ?? settings.targetWeight;
  const goals = computeGoals(settings, weightKg);

  const needsUpdate =
    settings.targetCalories !== goals.targetCalories ||
    settings.targetCarbs !== goals.targetCarbs ||
    settings.targetProtein !== goals.targetProtein ||
    settings.targetFat !== goals.targetFat;

  if (needsUpdate) {
    settings = await prisma.userSettings.update({
      where: { id: settings.id },
      data: goals,
    });
  }

  return settings;
}

export interface SettingsUpdateInput {
  targetWeight: number;
  birthYear: number;
  gender: Gender;
  heightCm: number;
  activityLevel: ActivityLevel;
}

export async function updateSettings(input: SettingsUpdateInput): Promise<UserSettings> {
  const existing = await getSettings();
  const weightKg = (await getLatestWeight()) ?? input.targetWeight;

  const profileData = {
    targetWeight: input.targetWeight,
    birthYear: input.birthYear,
    gender: input.gender,
    heightCm: input.heightCm,
    activityLevel: input.activityLevel,
  };

  const goals = computeGoals({ ...existing, ...profileData }, weightKg);

  return prisma.userSettings.update({
    where: { id: existing.id },
    data: { ...profileData, ...goals },
  });
}
