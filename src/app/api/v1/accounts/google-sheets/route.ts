import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseSpreadsheetId } from "@/lib/care/integrations/google-sheets/parse-spreadsheet-id";
import { isServiceAccountConfigured } from "@/lib/care/integrations/google-sheets/service-account";
import { handleRouteError, jsonOk, parseJsonBody } from "@/lib/api/route-utils";
import { apiError } from "@/lib/api-error";
import {
  readAccountSheetsConfig,
  resolveAccountSpreadsheetId,
  writeAccountSheetsConfig,
} from "@/lib/services/account-sheets-config";
import {
  exportTargetAccountsToGoogleSheets,
  getTargetAccountsPreview,
} from "@/lib/services/account-sheets-export";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  scheduleTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "실행 시각은 HH:MM 형식이어야 합니다.")
    .refine((val) => {
      const [h, m] = val.split(":").map(Number);
      return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    }, "유효한 시각(00:00~23:59)을 입력해 주세요.")
    .optional(),
  spreadsheetInput: z.string().optional(),
  sheetName: z.string().trim().min(1, "시트 탭 이름을 입력해 주세요.").max(60).optional(),
});

const exportSchema = z
  .object({
    refreshMarketPrices: z.boolean().optional(),
  })
  .optional();

async function buildStatusResponse() {
  const config = readAccountSheetsConfig();
  const resolved = await resolveAccountSpreadsheetId(config);
  const targetAccounts = await getTargetAccountsPreview();

  return {
    config,
    effectiveSpreadsheetId: resolved.spreadsheetId,
    spreadsheetSource: resolved.source,
    serviceAccountConfigured: isServiceAccountConfigured(),
    targetAccounts,
  };
}

export async function GET() {
  try {
    return jsonOk(await buildStatusResponse());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = parseJsonBody(updateSchema, await request.json());

    let nextSpreadsheetId: string | null | undefined = undefined;
    if (payload.spreadsheetInput !== undefined) {
      const trimmed = payload.spreadsheetInput.trim();
      if (!trimmed) {
        nextSpreadsheetId = null;
      } else {
        const parsed = parseSpreadsheetId(trimmed);
        if (!parsed) {
          return apiError(400, "유효한 구글 스프레드시트 URL 또는 ID가 아닙니다.");
        }
        nextSpreadsheetId = parsed;
      }
    }

    writeAccountSheetsConfig({
      ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
      ...(payload.scheduleTime !== undefined ? { scheduleTime: payload.scheduleTime } : {}),
      ...(nextSpreadsheetId !== undefined ? { spreadsheetId: nextSpreadsheetId } : {}),
      ...(payload.sheetName !== undefined ? { sheetName: payload.sheetName } : {}),
    });

    return jsonOk(await buildStatusResponse());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = rawBody.trim() ? JSON.parse(rawBody) : undefined;
    const payload = parseJsonBody(exportSchema, body);

    const result = await exportTargetAccountsToGoogleSheets({
      refreshMarketPrices: payload?.refreshMarketPrices ?? true,
    });
    const status = await buildStatusResponse();

    return jsonOk({ result, status });
  } catch (error) {
    return handleRouteError(error);
  }
}
