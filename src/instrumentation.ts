export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  try {
    const { prisma } = await import("@/lib/db");
    const { initializeAll } = await import("@/lib/services/core");
    const { processDueCardPayments } = await import("@/lib/services/card-payments");

    await initializeAll(prisma);
    await processDueCardPayments();
  } catch (error) {
    console.error("Startup hooks failed:", error);
  }
}
