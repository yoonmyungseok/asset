import type { RunningRecord, RunningSplit } from "@prisma/client";
import { formatPaceColon } from "@/lib/care/calculations/running";
import { getRunningTypeLabel } from "@/lib/care/constants";

export const RUNNING_SHEET_HEADERS = [
  "record_id",
  "date",
  "type",
  "type_label", // Daily_Log「종류」등 한글 라벨 열에 매핑
  "distance_km",
  "duration_sec",
  "avg_pace",
  "avg_hr",
  "max_hr",
  "cadence",
  "memo",
  "splits_json",
  "updated_at",
  "synced_at",
] as const;

export const RUNNING_SPLIT_SHEET_HEADERS = [
  "record_id",
  "date",
  "split_number",
  "distance_km",
  "duration_sec",
  "pace",
  "heart_rate",
  "cadence",
] as const;

type RunningTypeOption = { value: string; label: string };

type RecordWithSplits = RunningRecord & { splits: RunningSplit[] };

function splitToJson(split: RunningSplit) {
  return {
    km: split.splitNumber,
    distance_km: split.distance,
    duration_sec: split.durationSeconds,
    pace: formatPaceColon(split.paceSeconds),
    heart_rate: split.heartRate,
    cadence: split.cadence,
  };
}

export function recordToRunningFields(
  record: RecordWithSplits,
  types: RunningTypeOption[],
  syncedAt: string,
): Record<string, string | number> {
  const typeOptions = types.map(({ value, label }) => ({ value, label }));
  const splitsJson =
    record.splits.length > 0
      ? JSON.stringify(record.splits.map(splitToJson))
      : "";

  return {
    record_id: record.id,
    date: record.date,
    type: record.type,
    type_label: getRunningTypeLabel(record.type, typeOptions),
    distance_km: record.distance,
    duration_sec: record.durationSeconds,
    avg_pace: formatPaceColon(record.avgPaceSeconds),
    avg_hr: record.avgHeartRate ?? "",
    max_hr: record.maxHeartRate ?? "",
    cadence: record.cadence ?? "",
    memo: record.memo ?? "",
    splits_json: splitsJson,
    updated_at: record.updatedAt.toISOString(),
    synced_at: syncedAt,
  };
}

export function splitToFields(
  record: RecordWithSplits,
  split: RunningSplit,
): Record<string, string | number> {
  return {
    record_id: record.id,
    date: record.date,
    split_number: split.splitNumber,
    distance_km: split.distance,
    duration_sec: split.durationSeconds,
    pace: formatPaceColon(split.paceSeconds),
    heart_rate: split.heartRate ?? "",
    cadence: split.cadence ?? "",
  };
}
