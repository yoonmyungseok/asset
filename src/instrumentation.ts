export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  try {
    const { prisma } = await import("@/lib/db");
    const { initializeAll } = await import("@/lib/services/core");
    const { processDueCardPayments } = await import("@/lib/services/card-payments");
    const { startAccountSheetsScheduler } = await import("@/lib/services/account-sheets-scheduler");

    await initializeAll(prisma);
    await processDueCardPayments();
    startAccountSheetsScheduler();
  } catch (error) {
    console.error("Startup hooks failed:", error);
  }
}
