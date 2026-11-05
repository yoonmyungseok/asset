import { z } from "zod";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { generateInsight, latestInsight } from "@/lib/care/services/running-insights";

// 입력 길이를 제한하고 모델 종류와 파일 경로는 서버에서 관리한다.
const schema = z.object({ kind: z.enum(["analysis", "plan"]), context: z.string().max(2000).default("") });
export async function GET() {
  try {
    const [analysis, plan] = await Promise.all([latestInsight("analysis"), latestInsight("plan")]);
    return jsonResponse({ analysis, plan });
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
