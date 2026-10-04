import { describe, expect, it } from "vitest";
import { buildRunningRowIndex, buildSplitRowIndex } from "@/lib/care/integrations/google-sheets/sheet-row-index";

describe("buildRunningRowIndex", () => {
  const columns = new Map([["date", 0]]);

  it("maps date keys to 1-based sheet rows", () => {
    const values = [["2026-09-01"], ["2026-09-02"]];
    const map = buildRunningRowIndex(values, "date", columns);
    expect(map.get("2026-09-01")).toBe(2);
    expect(map.get("2026-09-02")).toBe(3);
  });

  it("excludes a reserved date for Daily_Log pin", () => {
    const values = [["2026-09-28"], ["2026-09-27"]];
    const map = buildRunningRowIndex(values, "date", columns, {
      excludeDateKey: "2026-09-28",
    });
    expect(map.has("2026-09-28")).toBe(false);
    expect(map.get("2026-09-27")).toBe(3);
  });
});

describe("buildSplitRowIndex", () => {
  const columns = new Map([
    ["date", 0],
    ["split_number", 1],
  ]);

  it("excludes all splits for reserved date", () => {
    const values = [
      ["2026-09-28", "1"],
      ["2026-09-28", "2"],
      ["2026-09-27", "1"],
    ];
    const map = buildSplitRowIndex(values, "date_split", columns, {
      excludeDateKey: "2026-09-28",
    });
    expect(map.size).toBe(1);
    expect(map.get("2026-09-27:1")).toBe(4);
  });
});
