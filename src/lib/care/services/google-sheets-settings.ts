import { prisma } from "@/lib/db";
import { getSettings as getUserSettings } from "@/lib/care/services/settings";

export interface GoogleSheetsSettingsRow {
  googleSpreadsheetId: string | null;
  googleRunningSheetName: string;
  googleRunningSplitSheetName: string;
  googleRunningHeaderMap: string | null;
  googleRunningSplitHeaderMap: string | null;
  googleRunningUpsertKey: string;
  googleRunningSplitUpsertKey: string;
  googleSheetsLastSyncedAt: Date | null;
}

const DEFAULTS: Omit<GoogleSheetsSettingsRow, "googleSheetsLastSyncedAt"> & {
  googleSheetsLastSyncedAt: null;
} = {
  googleSpreadsheetId: null,
  googleRunningSheetName: "러닝",
  googleRunningSplitSheetName: "러닝_스플릿",
  googleRunningHeaderMap: null,
  googleRunningSplitHeaderMap: null,
  googleRunningUpsertKey: "record_id",
  googleRunningSplitUpsertKey: "record_id_split",
  googleSheetsLastSyncedAt: null,
};

async function loadGoogleSheetsRow(userSettingsId: number): Promise<GoogleSheetsSettingsRow> {
  const rows = await prisma.$queryRaw<GoogleSheetsSettingsRow[]>`
    SELECT
      googleSpreadsheetId,
      googleRunningSheetName,
      googleRunningSplitSheetName,
      googleRunningHeaderMap,
      googleRunningSplitHeaderMap,
      googleRunningUpsertKey,
      googleRunningSplitUpsertKey,
      googleSheetsLastSyncedAt
    FROM UserSettings
    WHERE id = ${userSettingsId}
  `;

  const row = rows[0];
  if (!row) {
    return { ...DEFAULTS };
  }

  return {
    googleSpreadsheetId: row.googleSpreadsheetId,
    googleRunningSheetName: row.googleRunningSheetName ?? DEFAULTS.googleRunningSheetName,
    googleRunningSplitSheetName:
      row.googleRunningSplitSheetName ?? DEFAULTS.googleRunningSplitSheetName,
    googleRunningHeaderMap: row.googleRunningHeaderMap,
    googleRunningSplitHeaderMap: row.googleRunningSplitHeaderMap,
    googleRunningUpsertKey: row.googleRunningUpsertKey ?? DEFAULTS.googleRunningUpsertKey,
    googleRunningSplitUpsertKey:
      row.googleRunningSplitUpsertKey ?? DEFAULTS.googleRunningSplitUpsertKey,
    googleSheetsLastSyncedAt: row.googleSheetsLastSyncedAt,
  };
}

export async function getGoogleSheetsSettings(): Promise<GoogleSheetsSettingsRow> {
  const existing = await getUserSettings();
  return loadGoogleSheetsRow(existing.id);
}

export interface GoogleSheetsSettingsInput {
  spreadsheetInput?: string;
  googleRunningSheetName?: string;
  googleRunningSplitSheetName?: string;
  googleRunningHeaderMap?: string | null;
  googleRunningSplitHeaderMap?: string | null;
  googleRunningUpsertKey?: string;
  googleRunningSplitUpsertKey?: string;
}

export async function updateGoogleSheetsSettings(
  input: GoogleSheetsSettingsInput,
  spreadsheetId: string | null,
): Promise<GoogleSheetsSettingsRow> {
  const existing = await getUserSettings();
  const current = await loadGoogleSheetsRow(existing.id);

  const next: GoogleSheetsSettingsRow = {
    googleSpreadsheetId: spreadsheetId,
    googleRunningSheetName: input.googleRunningSheetName ?? current.googleRunningSheetName,
    googleRunningSplitSheetName:
      input.googleRunningSplitSheetName ?? current.googleRunningSplitSheetName,
    googleRunningHeaderMap:
      input.googleRunningHeaderMap !== undefined
        ? input.googleRunningHeaderMap?.trim() || null
        : current.googleRunningHeaderMap,
    googleRunningSplitHeaderMap:
      input.googleRunningSplitHeaderMap !== undefined
        ? input.googleRunningSplitHeaderMap?.trim() || null
        : current.googleRunningSplitHeaderMap,
    googleRunningUpsertKey: input.googleRunningUpsertKey ?? current.googleRunningUpsertKey,
    googleRunningSplitUpsertKey:
      input.googleRunningSplitUpsertKey ?? current.googleRunningSplitUpsertKey,
    googleSheetsLastSyncedAt: current.googleSheetsLastSyncedAt,
  };

  await prisma.$executeRaw`
    UPDATE UserSettings
    SET
      googleSpreadsheetId = ${next.googleSpreadsheetId},
      googleRunningSheetName = ${next.googleRunningSheetName},
      googleRunningSplitSheetName = ${next.googleRunningSplitSheetName},
      googleRunningHeaderMap = ${next.googleRunningHeaderMap},
      googleRunningSplitHeaderMap = ${next.googleRunningSplitHeaderMap},
      googleRunningUpsertKey = ${next.googleRunningUpsertKey},
      googleRunningSplitUpsertKey = ${next.googleRunningSplitUpsertKey}
    WHERE id = ${existing.id}
  `;

  return next;
}

export async function updateGoogleSheetsLastSyncedAt(iso: string): Promise<void> {
  const existing = await getUserSettings();
  const syncedAt = new Date(iso);
  await prisma.$executeRaw`
    UPDATE UserSettings
    SET googleSheetsLastSyncedAt = ${syncedAt}
    WHERE id = ${existing.id}
  `;
}
