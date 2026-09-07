import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import {
  classifyDriveFile,
  getAuthorizedDriveClient,
  getConnection,
  listCsvFilesInFolder,
  type DriveFileStatus,
} from "@/lib/googleDrive";
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

  const connection = await getConnection();
  if (!connection?.folderId) {
    return NextResponse.json({ error: "Configure a Drive folder first." }, { status: 400 });
  }

  try {
    const drive = await getAuthorizedDriveClient();
    const files = await listCsvFilesInFolder(drive, connection.folderId);

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const file of files) {
      const existing = await prisma.driveFile.findUnique({ where: { driveFileId: file.id } });
      const modifiedTime = new Date(file.modifiedTime);

      const status = classifyDriveFile(
        existing
          ? {
              status: existing.status as DriveFileStatus,
              lastProcessedVersion: existing.lastProcessedVersion,
            }
          : null,
        modifiedTime
      );
      if (status === null) continue; // mid-import — leave alone

      if (!existing) {
        await prisma.driveFile.create({
          data: { driveFileId: file.id, filename: file.name, driveModifiedAt: modifiedTime, status },
        });
        created += 1;
        continue;
      }

      if (status === "updated") updated += 1;
      if (status === "unchanged") unchanged += 1;

      await prisma.driveFile.update({
        where: { id: existing.id },
        data: { filename: file.name, driveModifiedAt: modifiedTime, status },
      });
    }

    await logAudit({
      userId: user.id,
      action: "drive_scan",
      entityType: "GoogleDriveConnection",
      metadata: { totalFound: files.length, created, updated, unchanged },
    });

    return NextResponse.json({ totalFound: files.length, created, updated, unchanged });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't scan the Drive folder." },
      { status: 500 }
    );
  }
}
