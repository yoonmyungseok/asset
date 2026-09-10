import { prisma } from "@/lib/db";
import { runSeed } from "../../prisma/seed";

export async function seedIfEmpty(): Promise<void> {
  const count = await prisma.accountType.count();
  if (count > 0) {
    return;
  }
  await runSeed(prisma);
}
