import type { RunningRecord, RunningSplit } from "@prisma/client";
import { isActiveRun } from "@/lib/care/calculations/running";
import { formatPaceColon } from "@/lib/care/calculations/running";
import { getRunningTypeLabel } from "@/lib/care/constants";
import { formatDuration } from "@/lib/care/utils";

type RunningTypeOption = { value: string; label: string };

type RecordWithSplits = RunningRecord & { splits: RunningSplit[] };

/** 시트에 하루 1행일 때, 같은 날짜는 id가 가장 큰 기록만 반영 */
export function pickRecordsForDailySheet(
  records: RecordWithSplits[],
  restDayTypeValues: string[],
): RecordWithSplits[] {
  const restSet = new Set(restDayTypeValues);
  const byDate = new Map<string, RecordWithSplits>();
  for (const record of records) {
    const prev = byDate.get(record.date);
    if (!prev || record.id > prev.id) {
      byDate.set(record.date, record);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

/** 구간 시트: 날짜별로 스플릿이 있는 기록 중 id가 가장 큰 것 (Daily_Log와 다른 건을 쓰는 경우 대비) */
export function pickRecordsForSplitSheet(
  allRecords: RecordWithSplits[],
  dates: Set<string>,
): RecordWithSplits[] {
  const picked: RecordWithSplits[] = [];
  for (const date of dates) {
    const withSplits = allRecords.filter((r) => r.date === date && r.splits.length > 0);
    if (withSplits.length === 0) continue;
    const best = withSplits.reduce((a, b) => (a.id > b.id ? a : b));
    picked.push(best);
  }
  return picked.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

export function recordToRunningFieldsForSheet(
  record: RecordWithSplits,
  types: RunningTypeOption[],
  restDayTypeValues: string[],
): Record<string, string | number> {
  const typeOptions = types.map(({ value, label }) => ({ value, label }));
  const restSet = new Set(restDayTypeValues);
  const label = getRunningTypeLabel(record.type, typeOptions);

  if (!isActiveRun(record, restSet)) {
    return {
      date: record.date,
      type_label: label,
      distance_km: "",
      duration_sec: "",
      avg_pace: "",
      avg_hr: "",
      max_hr: "",
      cadence: "",
      memo: record.memo ?? "",
    };
  }

  return {
    date: record.date,
    type_label: label,
    distance_km: record.distance,
    duration_sec: formatDuration(record.durationSeconds),
    avg_pace: formatPaceColon(record.avgPaceSeconds),
    avg_hr: record.avgHeartRate ?? "",
    max_hr: record.maxHeartRate ?? "",
    cadence: record.cadence ?? "",
    memo: record.memo ?? "",
  };
}

export function splitToFieldsForSheet(
  record: RecordWithSplits,
  split: RunningSplit,
): Record<string, string | number> {
  return {
    date: record.date,
    split_number: split.splitNumber,
    pace: formatPaceColon(split.paceSeconds),
    heart_rate: split.heartRate ?? "",
    cadence: split.cadence ?? "",
    memo: "",
  };
}
