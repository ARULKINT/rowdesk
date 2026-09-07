import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { downloadFileText, getAuthorizedDriveClient } from "@/lib/googleDrive";
import { importCsvText } from "@/lib/csvImport";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const pending = await prisma.driveFile.findMany({
    where: { status: { in: ["new", "updated"] } },
  });

  if (pending.length === 0) {
    return NextResponse.json({ processed: 0, failed: 0, results: [] });
  }

  let drive;
  try {
    drive = await getAuthorizedDriveClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Google Drive isn't connected." },
      { status: 400 }
    );
  }

  let processed = 0;
  let failed = 0;
  const results: { filename: string; ok: boolean; error?: string; imported?: number }[] = [];

  for (const file of pending) {
    await prisma.driveFile.update({ where: { id: file.id }, data: { status: "processing" } });

    try {
      const text = await downloadFileText(drive, file.driveFileId);
      const result = await importCsvText(text, file.filename, {
        userId: user.id,
        importedVia: "drive",
        driveFileId: file.id,
      });

      if (!result.ok) {
        await prisma.driveFile.update({
          where: { id: file.id },
          data: { status: "error", errorMessage: result.error },
        });
        failed += 1;
        results.push({ filename: file.filename, ok: false, error: result.error });
        continue;
      }

      await prisma.driveFile.update({
        where: { id: file.id },
        data: {
          status: "processed",
          errorMessage: null,
          lastProcessedAt: new Date(),
          lastProcessedVersion: file.driveModifiedAt,
        },
      });
      processed += 1;
      results.push({ filename: file.filename, ok: true, imported: result.summary.imported });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed.";
      await prisma.driveFile.update({
        where: { id: file.id },
        data: { status: "error", errorMessage: message },
      });
      failed += 1;
      results.push({ filename: file.filename, ok: false, error: message });
    }
  }

  await logAudit({
    userId: user.id,
    action: "drive_import",
    entityType: "GoogleDriveConnection",
    metadata: { processed, failed },
  });

  return NextResponse.json({ processed, failed, results });
}
