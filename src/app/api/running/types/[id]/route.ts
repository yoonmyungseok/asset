import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { runningTypeSchema } from "@/lib/care/validations/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const typeId = parseInt(id, 10);
    const body = await request.json();
    const parsed = runningTypeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const existing = await prisma.runningType.findUnique({ where: { id: typeId } });
    if (!existing) {
      return errorResponse("러닝 종류를 찾을 수 없습니다", 404);
    }

    const type = await prisma.$transaction(async (tx) => {
      if (existing.value !== parsed.data.value) {
        await tx.runningRecord.updateMany({
          where: { type: existing.value },
          data: { type: parsed.data.value },
        });
      }

      return tx.runningType.update({
        where: { id: typeId },
        data: parsed.data,
      });
    });

    return jsonResponse(type);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return errorResponse("이미 등록된 식별값입니다", 409);
    }
    console.error("PUT /api/running/types/[id]:", error);
    return errorResponse("러닝 종류를 수정하지 못했습니다", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const typeId = parseInt(id, 10);

    const existing = await prisma.runningType.findUnique({ where: { id: typeId } });
    if (!existing) {
      return errorResponse("러닝 종류를 찾을 수 없습니다", 404);
    }

    const recordCount = await prisma.runningRecord.count({
      where: { type: existing.value },
    });
    if (recordCount > 0) {
      return errorResponse(
        `이 종류를 사용하는 기록이 ${recordCount}건 있어 삭제할 수 없습니다`,
        409,
      );
    }

    await prisma.runningType.delete({ where: { id: typeId } });
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("DELETE /api/running/types/[id]:", error);
    return errorResponse("러닝 종류를 삭제하지 못했습니다", 500);
  }
}
