import { handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { seedCategories } from "@/lib/services/core";

export async function POST() {
  try {
    const count = await seedCategories();
    return jsonOk({ created: count, message: "기본 카테고리 생성 완료" });
  } catch (error) {
    return handleRouteError(error);
  }
}
