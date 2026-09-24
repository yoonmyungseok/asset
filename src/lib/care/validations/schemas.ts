import { z } from "zod";

export const weightRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "올바른 날짜 형식이 아닙니다"),
  weight: z.number().positive("체중은 0보다 커야 합니다"),
  steps: z.number().int().nonnegative().optional().nullable(),
  water: z.number().nonnegative().optional().nullable(),
  sleep: z.number().nonnegative().optional().nullable(),
  condition: z.string().optional().nullable(),
  bowelMovement: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
});

export const runningRecordBaseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().min(1, "러닝 종류를 선택해주세요"),
  distance: z.number().nonnegative(),
  durationSeconds: z.number().int().nonnegative(),
  avgHeartRate: z.number().int().nonnegative().optional().nullable(),
  maxHeartRate: z.number().int().nonnegative().optional().nullable(),
  cadence: z.number().int().nonnegative().optional().nullable(),
  memo: z.string().optional().nullable(),
});

export function validateRunningRecord(
  data: unknown,
  restDayTypeValues: string[] = ["rest"],
) {
  const parsed = runningRecordBaseSchema.safeParse(data);
  if (!parsed.success) return parsed;

  const restDaySet = new Set(restDayTypeValues);
  const issues: z.ZodIssue[] = [];

  if (restDaySet.has(parsed.data.type)) {
    if (parsed.data.distance !== 0) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: "휴식일은 거리를 입력할 수 없습니다",
        path: ["distance"],
      });
    }
    if (parsed.data.durationSeconds !== 0) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: "휴식일은 운동 시간을 입력할 수 없습니다",
        path: ["durationSeconds"],
      });
    }
  } else {
    if (parsed.data.distance <= 0) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: "거리는 0보다 커야 합니다",
        path: ["distance"],
      });
    }
    if (parsed.data.durationSeconds <= 0) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: "운동 시간은 0보다 커야 합니다",
        path: ["durationSeconds"],
      });
    }
  }

  if (issues.length > 0) {
    return { success: false as const, error: new z.ZodError(issues) };
  }

  return { success: true as const, data: parsed.data };
}

export const runningRecordSchema = runningRecordBaseSchema.superRefine((data, ctx) => {
  const result = validateRunningRecord(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: issue.path,
      });
    }
  }
});

export const runningSplitSchema = z.object({
  splitNumber: z.number().int().positive(),
  distance: z.number().positive("거리는 0보다 커야 합니다"),
  durationSeconds: z.number().int().positive("시간은 0보다 커야 합니다"),
  heartRate: z.number().int().nonnegative().optional().nullable(),
  cadence: z.number().int().nonnegative().optional().nullable(),
});

export const foodEntrySchema = z.object({
  mealId: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  foodName: z.string().min(1, "음식명을 입력해주세요"),
  amount: z.number().positive("섭취량은 0보다 커야 합니다"),
  unit: z.string().min(1, "단위를 입력해주세요"),
  calories: z.number().nonnegative("칼로리는 0 이상이어야 합니다"),
  carbs: z.number().nonnegative("탄수화물은 0 이상이어야 합니다"),
  protein: z.number().nonnegative("단백질은 0 이상이어야 합니다"),
  fat: z.number().nonnegative("지방은 0 이상이어야 합니다"),
  sodium: z.number().nonnegative().optional().nullable(),
  memo: z.string().optional().nullable(),
});

export const foodItemSchema = z.object({
  name: z.string().min(1, "음식명을 입력해주세요"),
  standardAmount: z.string().min(1, "기준 양을 입력해주세요"),
  calories: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  sodium: z.number().nonnegative().optional().nullable(),
});

export const runningTypeSchema = z.object({
  value: z
    .string()
    .min(1, "식별값을 입력해주세요")
    .regex(/^[a-z][a-z0-9_]*$/, "영문 소문자, 숫자, 밑줄만 사용 가능합니다"),
  label: z.string().min(1, "표시 이름을 입력해주세요"),
  excludeFromStats: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const googleSheetsSettingsSchema = z.object({
  spreadsheetInput: z.string().optional(),
  googleRunningSheetName: z.string().min(1, "러닝 시트 이름을 입력해주세요").optional(),
  googleRunningSplitSheetName: z.string().min(1, "스플릿 시트 이름을 입력해주세요").optional(),
  googleRunningHeaderMap: z.string().optional().nullable(),
  googleRunningSplitHeaderMap: z.string().optional().nullable(),
  googleRunningUpsertKey: z.enum(["record_id", "date"]).optional(),
  googleRunningSplitUpsertKey: z.enum(["record_id_split", "date_split"]).optional(),
});

export const settingsSchema = z.object({
  targetWeight: z.number().positive("목표 체중은 0보다 커야 합니다"),
  birthYear: z
    .number()
    .int()
    .min(1900, "올바른 출생년도를 입력해주세요")
    .max(new Date().getFullYear(), "올바른 출생년도를 입력해주세요"),
  gender: z.enum(["male", "female"]),
  heightCm: z.number().positive("키는 0보다 커야 합니다"),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
});

export type WeightRecordInput = z.infer<typeof weightRecordSchema>;
export type RunningRecordInput = z.infer<typeof runningRecordSchema>;
export type RunningSplitInput = z.infer<typeof runningSplitSchema>;
export type FoodEntryInput = z.infer<typeof foodEntrySchema>;
export type FoodItemInput = z.infer<typeof foodItemSchema>;
export type RunningTypeInput = z.infer<typeof runningTypeSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
