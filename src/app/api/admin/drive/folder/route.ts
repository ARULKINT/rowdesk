import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { extractFolderId, getAuthorizedDriveClient, verifyFolder } from "@/lib/googleDrive";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";
import { parseJsonBody } from "@/lib/validate";
import { driveFolderSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = await parseJsonBody(request, driveFolderSchema);
  if ("error" in parsed) return parsed.error;
  const folderId = extractFolderId(parsed.data.folder);

  try {
    const drive = await getAuthorizedDriveClient();
    const folder = await verifyFolder(drive, folderId);

    await prisma.googleDriveConnection.update({
      where: { singleton: true },
      data: { folderId: folder.id, folderName: folder.name },
    });

    await logAudit({
      userId: user.id,
      action: "drive_folder_set",
      entityType: "GoogleDriveConnection",
      metadata: { folderId: folder.id, folderName: folder.name },
    });

    return NextResponse.json({ folderId: folder.id, folderName: folder.name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't verify that folder." },
      { status: 400 }
    );
  }
}
