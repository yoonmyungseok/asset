import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { foodItemSchema } from "@/lib/care/validations/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = foodItemSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const item = await prisma.foodItem.update({
      where: { id: parseInt(id, 10) },
      data: parsed.data,
    });
    return jsonResponse(item);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return errorResponse("이미 등록된 음식입니다", 409);
    }
    console.error("PUT /api/diet/food-items/[id]:", error);
    return errorResponse("음식을 수정하지 못했습니다", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.foodItem.delete({ where: { id: parseInt(id, 10) } });
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("DELETE /api/diet/food-items/[id]:", error);
    return errorResponse("음식을 삭제하지 못했습니다", 500);
  }
}
