const SPREADSHEET_ID_PATTERN = /^[a-zA-Z0-9-_]{20,}$/;

/** Google 스프레드시트 URL 또는 ID에서 spreadsheetId 추출 */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (SPREADSHEET_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match?.[1]) return match[1];
  } catch {
    // not a URL
  }

  return null;
}
