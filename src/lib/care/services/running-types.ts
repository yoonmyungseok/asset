import { prisma } from "@/lib/db";
import { DEFAULT_RUNNING_TYPES } from "@/lib/care/running-type-defaults";

export interface RunningType {
  id: number;
  value: string;
  label: string;
  excludeFromStats: boolean;
  sortOrder: number;
}

export { DEFAULT_RUNNING_TYPES };

export async function ensureDefaultRunningTypes(): Promise<void> {
  const count = await prisma.runningType.count();
  if (count > 0) return;

  await prisma.runningType.createMany({ data: DEFAULT_RUNNING_TYPES });
}

export async function getRunningTypes(): Promise<RunningType[]> {
  await ensureDefaultRunningTypes();
  return prisma.runningType.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getRestDayTypeValues(): Promise<string[]> {
  const types = await getRunningTypes();
  return types.filter((t) => t.excludeFromStats).map((t) => t.value);
}

export async function getRestDayTypeSet(): Promise<Set<string>> {
  return new Set(await getRestDayTypeValues());
}

export function isRestDayType(type: string, types: RunningType[]): boolean {
  return types.find((t) => t.value === type)?.excludeFromStats ?? false;
}

export function getRunningTypeLabelFromList(value: string, types: RunningType[]): string {
  return types.find((t) => t.value === value)?.label ?? value;
}
