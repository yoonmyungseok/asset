import { formatPaceColon, formatDistanceKm } from "@/lib/care/calculations/running";
import { formatDuration } from "@/lib/care/utils";
import { getRunningTypeLabel, isRestDay } from "@/lib/care/constants";

interface RunningTypeOption {
  value: string;
  label: string;
  excludeFromStats?: boolean;
}

interface RunningSplit {
  splitNumber: number;
  distance: number;
  durationSeconds: number;
  paceSeconds?: number | null;
  heartRate?: number | null;
  cadence?: number | null;
}

interface RunningRecord {
  date: string;
  type: string;
  distance: number;
  durationSeconds: number;
  avgPaceSeconds: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  cadence: number | null;
  memo: string | null;
  splits: RunningSplit[];
}

function formatSplitLine(split: RunningSplit): string {
  const pace = formatPaceColon(split.paceSeconds);
  const parts = [`${split.splitNumber}km - 페이스: ${pace}`];

  if (split.heartRate != null) {
    parts.push(`심박수: ${split.heartRate}`);
  }
  if (split.cadence != null) {
    parts.push(`케이던스: ${split.cadence}`);
  }

  return parts.join(" / ");
}

export function formatRunningRecordText(
  record: RunningRecord,
  types?: RunningTypeOption[],
): string {
  const typeOptions = types?.map(({ value, label }) => ({ value, label }));
  const restDayValues = types?.filter((t) => t.excludeFromStats).map((t) => t.value);
  const lines = [
    `날짜: ${record.date}`,
    `종류: ${getRunningTypeLabel(record.type, typeOptions)}`,
  ];

  if (isRestDay(record.type, restDayValues)) {
    lines.push(`메모: ${record.memo ?? ""}`);
    return lines.join("\n");
  }

  lines.push(
    `거리: ${formatDistanceKm(record.distance)}`,
    `시간: ${formatDuration(record.durationSeconds)}`,
    `평균페이스: ${formatPaceColon(record.avgPaceSeconds)}/km`,
  );

  if (record.avgHeartRate != null) {
    lines.push(`평균심박: ${record.avgHeartRate}`);
  }
  if (record.maxHeartRate != null) {
    lines.push(`최대심박: ${record.maxHeartRate}`);
  }
  if (record.cadence != null) {
    lines.push(`케이던스: ${record.cadence}`);
  }

  lines.push(`메모: ${record.memo ?? ""}`);

  if (record.splits.length > 0) {
    lines.push("", "구간별 기록");
    for (const split of record.splits) {
      lines.push(formatSplitLine(split));
    }
  }

  return lines.join("\n");
}
