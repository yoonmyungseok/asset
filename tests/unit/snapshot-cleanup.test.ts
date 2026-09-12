/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { cleanupLegacyAccountSnapshots, getAccountTotalValue, saveDailySnapshot } from "@/lib/services/core";
import { apiClient } from "../helpers/api-client";
import { getAccountTypeId } from "../helpers/seed-ids";

describe("account snapshot cleanup", () => {
  it("stores holdings value for ISA accounts instead of cash only", async () => {
    const isaTypeId = await getAccountTypeId("ISA");

    const accountRes = await apiClient.post("/api/v1/accounts", {
      json: { account_type_id: isaTypeId, name: "스냅샷 ISA", cash_balance: 5608 },
    });
    const { id: accountId } = await accountRes.json<{ id: number }>();

    await apiClient.post("/api/v1/holdings", {
      json: {
        account_id: accountId,
        asset_class: "stock",
        symbol: "379780.KS",
        name: "RISE 미국S&P500",
        quantity: 68,
        avg_cost_price: 22000,
        manual_price: 22265,
      },
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      include: { account_type: true },
    });
    const totalValue = await getAccountTotalValue(prisma, account);

    await cleanupLegacyAccountSnapshots();
    await saveDailySnapshot();

    const latest = await prisma.accountSnapshot.findFirst({
      where: { account_id: accountId },
      orderBy: { snapshot_date: "desc" },
    });

    expect(latest).not.toBeNull();
    expect(Number(latest?.balance_value)).toBe(Number(totalValue.toFixed(2)));
    expect(Number(latest?.balance_value)).toBeGreaterThan(1000000);
    expect(Number(latest?.balance_value)).not.toBe(5608);
  });
});
