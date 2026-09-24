import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { foodEntrySchema } from "@/lib/care/validations/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = foodEntrySchema.omit({ mealId: true, date: true, mealType: true }).safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const entry = await prisma.foodEntry.update({
      where: { id: parseInt(id, 10) },
      data: parsed.data,
    });
    return jsonResponse(entry);
  } catch (error) {
    console.error("PUT /api/diet/entries/[id]:", error);
    return errorResponse("음식 기록을 수정하지 못했습니다", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const entry = await prisma.foodEntry.delete({
      where: { id: parseInt(id, 10) },
      include: { meal: { include: { foodEntries: true } } },
    });

    if (entry.meal.foodEntries.length === 0) {
      await prisma.meal.delete({ where: { id: entry.mealId } });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("DELETE /api/diet/entries/[id]:", error);
    return errorResponse("음식 기록을 삭제하지 못했습니다", 500);
  }
}
