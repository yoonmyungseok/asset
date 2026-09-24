import { describe, expect, it } from "vitest";
import { parseSpreadsheetId } from "@/lib/care/integrations/google-sheets/parse-spreadsheet-id";

describe("parseSpreadsheetId", () => {
  it("parses spreadsheet URL", () => {
    expect(
      parseSpreadsheetId(
        "https://docs.google.com/spreadsheets/d/1abcDEFghiJKLmnopQRstuVWxyz/edit#gid=0",
      ),
    ).toBe("1abcDEFghiJKLmnopQRstuVWxyz");
  });

  it("accepts raw id", () => {
    expect(parseSpreadsheetId("1abcDEFghiJKLmnopQRstuVWxyz")).toBe("1abcDEFghiJKLmnopQRstuVWxyz");
  });

  it("returns null for empty or invalid", () => {
    expect(parseSpreadsheetId("")).toBeNull();
    expect(parseSpreadsheetId("not-a-url")).toBeNull();
  });
});
