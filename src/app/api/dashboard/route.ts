import { getDashboardData } from "@/lib/care/services/dashboard";
import { errorResponse, jsonResponse } from "@/lib/care/utils";

export async function GET() {
  try {
    const data = await getDashboardData();
    return jsonResponse(data);
  } catch (error) {
    console.error("GET /api/dashboard:", error);
    return errorResponse("대시보드 데이터를 불러오지 못했습니다", 500);
  }
}
