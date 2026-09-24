import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { getSettings } from "@/lib/care/services/settings";
import { calculateNutritionSummary } from "@/lib/care/calculations/diet";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return errorResponse("날짜를 지정해주세요");
    }

    const meals = await prisma.meal.findMany({
      where: { date },
      include: { foodEntries: { orderBy: { createdAt: "asc" } } },
      orderBy: { mealType: "asc" },
    });

    const settings = await getSettings();
    const allEntries = meals.flatMap((m) => m.foodEntries);
    const summary = calculateNutritionSummary(allEntries, settings);

    return jsonResponse({ meals, summary, targets: settings });
  } catch (error) {
    console.error("GET /api/diet:", error);
    return errorResponse("식단 기록을 불러오지 못했습니다", 500);
  }
}
