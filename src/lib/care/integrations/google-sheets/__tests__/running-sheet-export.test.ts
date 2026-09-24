import { describe, expect, it } from "vitest";
import { pickRecordsForSplitSheet } from "@/lib/care/integrations/google-sheets/running-sheet-export";

describe("pickRecordsForSplitSheet", () => {
  it("prefers record with splits on the same date", () => {
    const records = [
      {
        id: 2,
        date: "2026-09-14",
        type: "easy",
        distance: 5,
        durationSeconds: 1800,
        splits: [],
      },
      {
        id: 5,
        date: "2026-09-14",
        type: "easy",
        distance: 5,
        durationSeconds: 1800,
        splits: [{ splitNumber: 1, distance: 1, durationSeconds: 400, paceSeconds: 400 }],
      },
    ] as Parameters<typeof pickRecordsForSplitSheet>[0];

    const picked = pickRecordsForSplitSheet(records, new Set(["2026-09-14"]));
    expect(picked).toHaveLength(1);
    expect(picked[0].id).toBe(5);
  });
});
