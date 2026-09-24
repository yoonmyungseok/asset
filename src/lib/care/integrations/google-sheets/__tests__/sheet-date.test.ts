import { describe, expect, it } from "vitest";
import { normalizeDateKey, normalizeSplitKey } from "@/lib/care/integrations/google-sheets/sheet-date";

describe("normalizeDateKey", () => {
  it("parses ISO datetime strings", () => {
    expect(normalizeDateKey("2026-09-13 00:00:00")).toBe("2026-09-13");
  });

  it("parses plain date", () => {
    expect(normalizeDateKey("2026-09-13")).toBe("2026-09-13");
  });
});

describe("normalizeSplitKey", () => {
  it("normalizes float km index", () => {
    expect(normalizeSplitKey("1.0")).toBe("1");
  });
});
