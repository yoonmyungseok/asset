import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { getRunningTypes } from "@/lib/care/services/running-types";
import { runningTypeSchema } from "@/lib/care/validations/schemas";

export async function GET() {
  try {
    const types = await getRunningTypes();
    return jsonResponse(types);
  } catch (error) {
    console.error("GET /api/running/types:", error);
    return errorResponse("러닝 종류를 불러오지 못했습니다", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = runningTypeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const type = await prisma.runningType.create({ data: parsed.data });
    return jsonResponse(type, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return errorResponse("이미 등록된 식별값입니다", 409);
    }
    console.error("POST /api/running/types:", error);
    return errorResponse("러닝 종류를 저장하지 못했습니다", 500);
  }
}
