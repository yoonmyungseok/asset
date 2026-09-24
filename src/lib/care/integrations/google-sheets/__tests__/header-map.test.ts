import { describe, expect, it } from "vitest";
import { buildColumnIndex, buildSheetRow } from "@/lib/care/integrations/google-sheets/header-map";

describe("buildColumnIndex", () => {
  it("matches headers by field name or alias", () => {
    const headerRow = ["날짜", "기록ID", "거리(km)"];
    const index = buildColumnIndex(headerRow, ["date", "record_id", "distance_km"], {
      date: "날짜",
      record_id: "기록ID",
      distance_km: "거리(km)",
    });
    expect(index.get("date")).toBe(0);
    expect(index.get("record_id")).toBe(1);
    expect(index.get("distance_km")).toBe(2);
  });
});

describe("buildSheetRow", () => {
  it("places values at mapped column indices", () => {
    const index = new Map([
      ["record_id", 1],
      ["date", 0],
    ]);
    const row = buildSheetRow({ date: "2025-01-01", record_id: 42 }, index, 3);
    expect(row).toEqual(["2025-01-01", 42, ""]);
  });
});
