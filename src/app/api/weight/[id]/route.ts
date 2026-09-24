import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { weightRecordSchema } from "@/lib/care/validations/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const record = await prisma.weightRecord.findUnique({
      where: { id: parseInt(id, 10) },
    });
    if (!record) return errorResponse("기록을 찾을 수 없습니다", 404);
    return jsonResponse(record);
  } catch (error) {
    console.error("GET /api/weight/[id]:", error);
    return errorResponse("체중 기록을 불러오지 못했습니다", 500);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = weightRecordSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const record = await prisma.weightRecord.update({
      where: { id: parseInt(id, 10) },
      data: parsed.data,
    });
    return jsonResponse(record);
  } catch (error) {
    console.error("PUT /api/weight/[id]:", error);
    return errorResponse("체중 기록을 수정하지 못했습니다", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.weightRecord.delete({ where: { id: parseInt(id, 10) } });
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("DELETE /api/weight/[id]:", error);
    return errorResponse("체중 기록을 삭제하지 못했습니다", 500);
  }
}
