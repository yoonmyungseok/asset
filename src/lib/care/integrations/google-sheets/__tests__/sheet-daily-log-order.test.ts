import { describe, expect, it } from "vitest";
import {
  findDailyLogInsertRow1Based,
  formatDateForDailyLogSheet,
  inferDailyLogDateSample,
} from "@/lib/care/integrations/google-sheets/sheet-daily-log-order";

describe("formatDateForDailyLogSheet", () => {
  it("uses dot format when sample uses dots", () => {
    expect(formatDateForDailyLogSheet("2026-09-20", "2026. 6. 6")).toBe("2026. 9. 20");
  });

  it("keeps ISO when no dot sample", () => {
    expect(formatDateForDailyLogSheet("2026-09-20")).toBe("2026-09-20");
  });
});

describe("inferDailyLogDateSample", () => {
  it("reads dot format from first past row", () => {
    const sample = inferDailyLogDateSample(
      [["2026-09-28"], ["2026. 6. 6"]],
      0,
      "2026-09-28",
    );
    expect(sample).toBe("2026. 6. 6");
  });
});

describe("findDailyLogInsertRow1Based", () => {
  const dateCol = 0;

  it("inserts before older dates (row 3 when newer than June)", () => {
    const rows = [["2026-09-28"], ["2026. 6. 6"], ["2026. 6. 4"]];
    expect(findDailyLogInsertRow1Based(rows, dateCol, "2026-09-20")).toBe(3);
  });

  it("appends when older than all existing past rows", () => {
    const rows = [["2026-09-28"], ["2026. 6. 6"]];
    expect(findDailyLogInsertRow1Based(rows, dateCol, "2026-05-01")).toBe(4);
  });
});
