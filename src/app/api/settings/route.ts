import { getSettings, updateSettings } from "@/lib/care/services/settings";
import { errorResponse, jsonResponse } from "@/lib/care/utils";
import { settingsSchema } from "@/lib/care/validations/schemas";

export async function GET() {
  try {
    const settings = await getSettings();
    return jsonResponse(settings);
  } catch (error) {
    console.error("GET /api/settings:", error);
    return errorResponse("설정을 불러오지 못했습니다", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const settings = await updateSettings(parsed.data);
    return jsonResponse(settings);
  } catch (error) {
    console.error("PUT /api/settings:", error);
    return errorResponse("설정을 저장하지 못했습니다", 500);
  }
}
