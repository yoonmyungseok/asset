import { describe, it, expect } from "vitest";
import { formatRunningRecordText } from "@/lib/care/format/running-text";
import { runningRecordSchema } from "@/lib/care/validations/schemas";
import { normalizeRunningRecord } from "@/lib/care/calculations/running";

describe("formatRunningRecordText", () => {
  it("formats a running record for clipboard copy", () => {
    const text = formatRunningRecordText({
      date: "2026-09-05",
      type: "tempo",
      distance: 5,
      durationSeconds: 39 * 60 + 34,
      avgPaceSeconds: 7 * 60 + 54,
      avgHeartRate: 137,
      maxHeartRate: 158,
      cadence: 169,
      memo: null,
      splits: [
        { splitNumber: 1, distance: 1, durationSeconds: 9 * 60 + 14, paceSeconds: 9 * 60 + 14, heartRate: 127, cadence: 166 },
        { splitNumber: 2, distance: 1, durationSeconds: 8 * 60, paceSeconds: 8 * 60, heartRate: 134, cadence: 172 },
        { splitNumber: 3, distance: 1, durationSeconds: 6 * 60 + 45, paceSeconds: 6 * 60 + 45, heartRate: 144, cadence: 173 },
        { splitNumber: 4, distance: 1, durationSeconds: 6 * 60 + 18, paceSeconds: 6 * 60 + 18, heartRate: 152, cadence: 172 },
        { splitNumber: 5, distance: 1, durationSeconds: 9 * 60 + 12, paceSeconds: 9 * 60 + 12, heartRate: 135, cadence: 168 },
      ],
    });

    expect(text).toBe(
      `날짜: 2026-09-05
종류: 지속주
거리: 5km
시간: 39:34
평균페이스: 7:54/km
평균심박: 137
최대심박: 158
케이던스: 169
메모: 

구간별 기록
1km - 페이스: 9:14 / 심박수: 127 / 케이던스: 166
2km - 페이스: 8:00 / 심박수: 134 / 케이던스: 172
3km - 페이스: 6:45 / 심박수: 144 / 케이던스: 173
4km - 페이스: 6:18 / 심박수: 152 / 케이던스: 172
5km - 페이스: 9:12 / 심박수: 135 / 케이던스: 168`,
    );
  });

  it("formats a rest day record", () => {
    const text = formatRunningRecordText({
      date: "2026-09-07",
      type: "rest",
      distance: 0,
      durationSeconds: 0,
      avgPaceSeconds: null,
      avgHeartRate: null,
      maxHeartRate: null,
      cadence: null,
      memo: "무릎 휴식",
      splits: [],
    });

    expect(text).toBe(`날짜: 2026-09-07
종류: 휴식
메모: 무릎 휴식`);
  });
});

describe("runningRecordSchema", () => {
  it("accepts rest days with zero distance and duration", () => {
    const parsed = runningRecordSchema.safeParse({
      date: "2026-09-07",
      type: "rest",
      distance: 0,
      durationSeconds: 0,
      memo: "휴식",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects rest days with distance", () => {
    const parsed = runningRecordSchema.safeParse({
      date: "2026-09-07",
      type: "rest",
      distance: 5,
      durationSeconds: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("normalizes rest day payloads", () => {
    const normalized = normalizeRunningRecord({
      date: "2026-09-07",
      type: "rest",
      distance: 5,
      durationSeconds: 3600,
      avgHeartRate: 120,
      maxHeartRate: 140,
      cadence: 170,
    });

    expect(normalized).toEqual({
      date: "2026-09-07",
      type: "rest",
      distance: 0,
      durationSeconds: 0,
      avgHeartRate: null,
      maxHeartRate: null,
      cadence: null,
    });
  });
});
