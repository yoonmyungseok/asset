import path from "path";

export function resolveDatabaseFilePath(): string {
  const configured = process.env.DATABASE_URL;
  if (configured?.startsWith("file:")) {
    const filePath = configured.slice("file:".length);
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    if (filePath.startsWith("./") || filePath.startsWith("../")) {
      return path.resolve(process.cwd(), filePath);
    }
    return filePath;
  }

  return path.join(process.cwd(), "data", "asset.db");
}

export function resolveDatabaseUrl(): string {
  return `file:${resolveDatabaseFilePath()}`;
}
