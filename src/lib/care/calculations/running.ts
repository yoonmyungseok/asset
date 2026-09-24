function isRestDayType(type: string, restDayTypes?: Set<string>): boolean {
  if (restDayTypes) return restDayTypes.has(type);
  return type === "rest";
}

export function isActiveRun(
  record: { type?: string },
  restDayTypes?: Set<string>,
): boolean {
  return !isRestDayType(record.type ?? "", restDayTypes);
}

export function normalizeRunningRecord<
  T extends {
    type: string;
    distance: number;
    durationSeconds: number;
    avgHeartRate?: number | null;
    maxHeartRate?: number | null;
    cadence?: number | null;
  },
>(data: T, restDayTypes?: Set<string>): T {
  if (!isRestDayType(data.type, restDayTypes)) return data;

  return {
    ...data,
    distance: 0,
    durationSeconds: 0,
    avgHeartRate: null,
    maxHeartRate: null,
    cadence: null,
  };
}

/**
 * Calculate average pace in seconds per km.
 * pace = duration(minutes) / distance(km)
 */
export function calculatePaceSeconds(
  distanceKm: number,
  durationSeconds: number,
): number | null {
  if (!distanceKm || distanceKm <= 0 || !durationSeconds || durationSeconds <= 0) {
    return null;
  }
  const durationMinutes = durationSeconds / 60;
  const paceMinutes = durationMinutes / distanceKm;
  return paceMinutes * 60;
}

export function formatPace(paceSeconds: number | null | undefined): string {
  if (paceSeconds == null || !Number.isFinite(paceSeconds) || paceSeconds <= 0) {
    return "-";
  }
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}'${seconds.toString().padStart(2, "0")}"/km`;
}

export function formatPaceColon(paceSeconds: number | null | undefined): string {
  if (paceSeconds == null || !Number.isFinite(paceSeconds) || paceSeconds <= 0) {
    return "-";
  }
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatDistanceKm(distance: number): string {
  const value = distance % 1 === 0 ? distance.toString() : distance.toFixed(1);
  return `${value}km`;
}

export function calculateAveragePace(
  records: { distance: number; durationSeconds: number; type?: string }[],
  restDayTypes?: Set<string>,
): number | null {
  const valid = records.filter(
    (r) => isActiveRun(r, restDayTypes) && r.distance > 0 && r.durationSeconds > 0,
  );
  if (valid.length === 0) return null;

  const totalDistance = valid.reduce((sum, r) => sum + r.distance, 0);
  const totalDuration = valid.reduce((sum, r) => sum + r.durationSeconds, 0);
  return calculatePaceSeconds(totalDistance, totalDuration);
}

export function sumDistance(
  records: { distance: number; type?: string }[],
  restDayTypes?: Set<string>,
): number {
  return records
    .filter((r) => isActiveRun(r, restDayTypes))
    .reduce((sum, r) => sum + r.distance, 0);
}

export function countRecords(
  records: { date: string; distance?: number; type?: string }[],
  startDate: string,
  endDate: string,
  restDayTypes?: Set<string>,
): number {
  return records.filter((r) => {
    if (r.date < startDate || r.date > endDate) return false;
    if (!isActiveRun(r, restDayTypes)) return false;
    if (typeof r.distance === "number" && r.distance <= 0) return false;
    return true;
  }).length;
}

export function findLongestRun(
  records: { date: string; distance: number; type?: string }[],
  restDayTypes?: Set<string>,
): { distance: number; date: string } | null {
  const activeRuns = records.filter((r) => isActiveRun(r, restDayTypes));
  if (activeRuns.length === 0) return null;

  const longest = activeRuns.reduce((best, record) =>
    record.distance > best.distance ? record : best,
  );

  return { distance: longest.distance, date: longest.date };
}

export function formatDistanceChange(changeKm: number): string {
  if (changeKm === 0) return "0 km";
  const sign = changeKm > 0 ? "+" : "";
  return `${sign}${changeKm.toFixed(1)} km`;
}
