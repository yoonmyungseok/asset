import { copyFile, writeFile } from "fs/promises";
import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-error";
import { handleRouteError, jsonOk } from "@/lib/api/route-utils";
import { resolveDatabaseFilePath } from "@/lib/database-path";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ServiceError(400, "SQLite .db 파일만 업로드할 수 있습니다.");
    }
    if (!file.name.endsWith(".db")) {
      return apiError(400, "SQLite .db 파일만 업로드할 수 있습니다.");
    }

    const dbPath = resolveDatabaseFilePath();
    const backupPath = `${dbPath}.bak`;

    await prisma.$disconnect();

    try {
      await copyFile(dbPath, backupPath);
    } catch {
      // Original DB may not exist yet.
    }

    const contents = Buffer.from(await file.arrayBuffer());
    await writeFile(dbPath, contents);

    await prisma.$connect();

    return jsonOk({
      message: "복구 완료",
      restored_at: new Date(),
    });
  } catch (error) {
    try {
      await prisma.$connect();
    } catch {
      // Ignore reconnect failure; original error is more important.
    }
    return handleRouteError(error);
  }
}
