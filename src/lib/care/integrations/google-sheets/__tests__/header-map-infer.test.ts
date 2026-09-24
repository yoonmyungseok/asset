import { describe, expect, it } from "vitest";
import {
  buildColumnIndex,
  resolveRunningHeaderAliases,
  resolveRunningUpsertKey,
} from "@/lib/care/integrations/google-sheets/header-map";
import { RUNNING_SHEET_HEADERS } from "@/lib/care/integrations/google-sheets/running-rows";

const DAILY_LOG_HEADERS = [
  "날짜",
  "종류",
  "거리(km)",
  "시간",
  "평균페이스",
  "평균심박",
  "최대심박",
  "케이던스",
  "특이사항",
];

describe("resolveRunningHeaderAliases", () => {
  it("applies Korean preset when mapping is empty", () => {
    const aliases = resolveRunningHeaderAliases(undefined, DAILY_LOG_HEADERS);
    expect(aliases?.date).toBe("날짜");
    const columns = buildColumnIndex(DAILY_LOG_HEADERS, RUNNING_SHEET_HEADERS, aliases);
    expect(columns.has("date")).toBe(true);
    expect(columns.has("type_label")).toBe(true);
  });
});

describe("resolveRunningUpsertKey", () => {
  it("uses date when record_id column is absent", () => {
    const aliases = resolveRunningHeaderAliases(undefined, DAILY_LOG_HEADERS)!;
    const columns = buildColumnIndex(DAILY_LOG_HEADERS, RUNNING_SHEET_HEADERS, aliases);
    expect(resolveRunningUpsertKey("record_id", columns)).toBe("date");
  });
});
