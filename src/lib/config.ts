import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const CREDENTIALS_FILE = path.join(DATA_DIR, "toss_credentials.json");

export type TossCredentials = {
  clientId: string | null;
  clientSecret: string | null;
  baseUrl: string;
};

async function loadFileCredentials(): Promise<{
  clientId: string | null;
  clientSecret: string | null;
}> {
  try {
    const raw = await readFile(CREDENTIALS_FILE, "utf-8");
    const data = JSON.parse(raw) as {
      client_id?: string;
      client_secret?: string;
    };
    return {
      clientId: data.client_id ?? null,
      clientSecret: data.client_secret ?? null,
    };
  } catch {
    return { clientId: null, clientSecret: null };
  }
}

export async function getTossCredentials(): Promise<TossCredentials> {
  const clientId = process.env.TOSS_CLIENT_ID ?? null;
  const clientSecret = process.env.TOSS_CLIENT_SECRET ?? null;
  const baseUrl = process.env.TOSS_BASE_URL ?? "https://openapi.tossinvest.com";

  if (clientId && clientSecret) {
    return { clientId, clientSecret, baseUrl };
  }

  const fileCredentials = await loadFileCredentials();
  return {
    clientId: fileCredentials.clientId,
    clientSecret: fileCredentials.clientSecret,
    baseUrl,
  };
}

export async function saveTossCredentials(
  clientId: string,
  clientSecret: string,
): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    CREDENTIALS_FILE,
    JSON.stringify({ client_id: clientId, client_secret: clientSecret }, null, 0),
    "utf-8",
  );
}

export async function clearTossCredentials(): Promise<void> {
  try {
    await unlink(CREDENTIALS_FILE);
  } catch {
    // File may not exist.
  }
}
