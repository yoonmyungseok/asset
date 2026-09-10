import { initializeAll } from "@/lib/services/core";
import { handleRouteError, jsonOk } from "@/lib/api/route-utils";

export async function POST() {
  try {
    const counts = await initializeAll();
    return jsonOk(
      {
        account_types: counts.account_types,
        payment_methods: counts.payment_methods,
        categories: counts.categories,
        message: "초기 설정 완료",
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
