import { copyFile, readFile, writeFile } from "fs/promises";

import { apiError } from "@/lib/api-error";
import { handleRouteError } from "@/lib/api/route-utils";
import { resolveDatabaseFilePath } from "@/lib/database-path";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const dbPath = resolveDatabaseFilePath();
    try {
      await readFile(dbPath);
    } catch {
      return apiError(404, "백업할 DB 파일이 없습니다.");
    }

    const filename = `asset_backup_${new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 15)}.db`;
    const buffer = await readFile(dbPath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
