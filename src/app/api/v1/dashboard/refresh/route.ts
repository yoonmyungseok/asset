import { handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { saveDailySnapshot } from "@/lib/services/core";
import { prisma } from "@/lib/db";
import { refreshPrices } from "@/lib/services/holdings";
import { generateRecurringItems } from "@/lib/services/recurring-items";

export async function POST() {
  try {
    const prices = await refreshPrices();
    const today = new Date();
    const recurring = await generateRecurringItems(today.getFullYear(), today.getMonth() + 1);
    await saveDailySnapshot(prisma, today);

    return jsonOk({
      prices_updated: prices.updated,
      recurring_generated: recurring.generated,
      snapshot_saved: true,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
