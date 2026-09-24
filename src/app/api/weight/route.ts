import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { weightRecordSchema } from "@/lib/care/validations/schemas";
import { getSettings } from "@/lib/care/services/settings";
import { calculateWeightStats, getWeightChartData } from "@/lib/care/calculations/weight";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const days = parseInt(searchParams.get("days") ?? "30", 10);
    const settings = await getSettings();

    if (date) {
      const record = await prisma.weightRecord.findUnique({ where: { date } });
      return jsonResponse(record);
    }

    const records = await prisma.weightRecord.findMany({
      orderBy: { date: "desc" },
    });

    const stats = calculateWeightStats(records, settings.targetWeight);
    const chartData = getWeightChartData(records, days);

    return jsonResponse({ records, stats, chartData });
  } catch (error) {
    console.error("GET /api/weight:", error);
    return errorResponse("체중 기록을 불러오지 못했습니다", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = weightRecordSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const record = await prisma.weightRecord.create({ data: parsed.data });
    return jsonResponse(record, 201);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return errorResponse("해당 날짜에 이미 체중 기록이 있습니다", 409);
    }
    console.error("POST /api/weight:", error);
    return errorResponse("체중 기록을 저장하지 못했습니다", 500);
  }
}
