import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { foodItemSchema } from "@/lib/care/validations/schemas";

export async function GET() {
  try {
    const items = await prisma.foodItem.findMany({ orderBy: { name: "asc" } });
    return jsonResponse(items);
  } catch (error) {
    console.error("GET /api/diet/food-items:", error);
    return errorResponse("음식 DB를 불러오지 못했습니다", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = foodItemSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const item = await prisma.foodItem.create({ data: parsed.data });
    return jsonResponse(item, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return errorResponse("이미 등록된 음식입니다", 409);
    }
    console.error("POST /api/diet/food-items:", error);
    return errorResponse("음식을 저장하지 못했습니다", 500);
  }
}
