import { google, type sheets_v4 } from "googleapis";
import { loadServiceAccountCredentials } from "@/lib/care/integrations/google-sheets/service-account";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export function getGoogleSheetsClient(): sheets_v4.Sheets {
  const credentials = loadServiceAccountCredentials();
  if (!credentials) {
    throw new Error(
      "Google 서비스 계정이 설정되지 않았습니다. .env에 GOOGLE_APPLICATION_CREDENTIALS(파일 경로), " +
        "GOOGLE_SERVICE_ACCOUNT_JSON, 또는 GOOGLE_SERVICE_ACCOUNT_EMAIL + PRIVATE_KEY를 설정하세요.",
    );
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [SHEETS_SCOPE],
  });
  return google.sheets({ version: "v4", auth });
}

export function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}
