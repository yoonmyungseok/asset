import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** .env에 넣은 JSON 문자열 파싱 (Windows 따옴표·이스케이프 오류 흔함) */
export function parseServiceAccountJson(raw: string): ServiceAccountCredentials {
  const text = stripOuterQuotes(raw.trim());
  if (text.startsWith("{")) {
    try {
      return parseCredentialsObject(JSON.parse(text));
    } catch (error) {
      throw formatJsonParseError(error);
    }
  }

  // 일부 환경에서 앞뒤에 잘못된 문자가 붙는 경우
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return parseCredentialsObject(JSON.parse(text.slice(start, end + 1)));
    } catch (error) {
      throw formatJsonParseError(error);
    }
  }

  throw new Error(
    "GOOGLE_SERVICE_ACCOUNT_JSON이 올바른 JSON이 아닙니다. " +
      "대신 GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY 를 쓰거나, " +
      "GOOGLE_APPLICATION_CREDENTIALS에 JSON 파일 경로를 지정하세요.",
  );
}

function parseCredentialsObject(parsed: unknown): ServiceAccountCredentials {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("서비스 계정 JSON 형식이 올바르지 않습니다.");
  }
  const obj = parsed as Record<string, unknown>;
  const client_email = obj.client_email;
  const private_key = obj.private_key;
  if (typeof client_email !== "string" || typeof private_key !== "string") {
    throw new Error("서비스 계정 JSON에 client_email, private_key가 필요합니다.");
  }
  return {
    client_email,
    private_key: private_key.replace(/\\n/g, "\n"),
  };
}

function formatJsonParseError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(
    `GOOGLE_SERVICE_ACCOUNT_JSON 파싱 실패: ${detail}. ` +
      "JSON 전체를 한 줄로 넣거나, EMAIL/PRIVATE_KEY 방식·JSON 파일 경로(GOOGLE_APPLICATION_CREDENTIALS)를 사용하세요.",
  );
}

function loadFromCredentialsFile(): ServiceAccountCredentials | null {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!path) return null;

  const absolute = resolve(process.cwd(), path);
  const raw = readFileSync(absolute, "utf8");
  return parseServiceAccountJson(raw);
}

export function loadServiceAccountCredentials(): ServiceAccountCredentials | null {
  const fromFile = loadFromCredentialsFile();
  if (fromFile) return fromFile;

  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    return parseServiceAccountJson(json);
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && privateKey) {
    return { client_email: email, private_key: privateKey };
  }

  return null;
}

export function isServiceAccountConfigured(): boolean {
  return loadServiceAccountCredentials() != null;
}
