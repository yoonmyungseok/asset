import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { foodEntrySchema } from "@/lib/care/validations/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = foodEntrySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const { mealId, date, mealType, ...entryData } = parsed.data;

    let targetMealId = mealId;

    if (!targetMealId) {
      if (!date || !mealType) {
        return errorResponse("날짜와 식사 구분이 필요합니다");
      }

      const meal = await prisma.meal.upsert({
        where: { date_mealType: { date, mealType } },
        create: { date, mealType },
        update: {},
      });
      targetMealId = meal.id;
    }

    const entry = await prisma.foodEntry.create({
      data: { ...entryData, mealId: targetMealId },
    });

    return jsonResponse(entry, 201);
  } catch (error) {
    console.error("POST /api/diet/entries:", error);
    return errorResponse("음식 기록을 저장하지 못했습니다", 500);
  }
}
