import { z } from "zod";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { generateInsight, latestInsight, getRunningGoal, saveRunningGoal } from "@/lib/care/services/running-insights";

// 입력 길이를 제한하고 모델 종류와 파일 경로는 서버에서 관리한다.
const schema = z.object({ kind: z.enum(["analysis", "plan"]), context: z.string().max(2000).default("") });
export async function GET() {
  try {
    const [analysis, plan, goal] = await Promise.all([latestInsight("analysis"), latestInsight("plan"), getRunningGoal()]);
    return jsonResponse({ analysis, plan, goal });
  } catch { return errorResponse("저장된 러닝 보고서를 불러오지 못했습니다.", 500); }
}
export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return errorResponse("요청 내용을 확인해 주세요.");
    return jsonResponse(await generateInsight(parsed.data.kind, parsed.data.context));
  } catch (error) {
    console.error("러닝 보고서 생성 실패:", error);
    return errorResponse(error instanceof Error ? error.message : "러닝 보고서를 생성하지 못했습니다.", 500);
  }
}

// 목표를 빈 문자열로 저장하면 기존 목표를 지울 수 있다.
export async function PUT(request: Request) {
  try {
    const parsed = z.object({ goal: z.string().trim().max(500) }).safeParse(await request.json());
    if (!parsed.success) return errorResponse("목표는 500자 이내로 입력해 주세요.");
    await saveRunningGoal(parsed.data.goal);
    return jsonResponse({ goal: parsed.data.goal });
  } catch {
    return errorResponse("러닝 목표를 저장하지 못했습니다.", 500);
  }
}
