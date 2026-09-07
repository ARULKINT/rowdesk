import { prisma } from "@/lib/prisma";
import { getConfiguredFolderId, isGoogleDriveConfigured } from "@/lib/googleDrive";
import DrivePanel, { type DriveFileDTO } from "./DrivePanel";

export const dynamic = "force-dynamic";

export default async function AdminDrivePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;

  const [connection, files] = await Promise.all([
    prisma.googleDriveConnection.findUnique({ where: { singleton: true } }),
    prisma.driveFile.findMany({
      orderBy: { driveModifiedAt: "desc" },
      include: { sourceFiles: { select: { id: true, records: { select: { id: true } } } } },
    }),
  ]);

  const fileDtos: DriveFileDTO[] = files.map((f) => ({
    id: f.id,
    filename: f.filename,
    driveModifiedAt: f.driveModifiedAt.toISOString(),
    lastProcessedAt: f.lastProcessedAt ? f.lastProcessedAt.toISOString() : null,
    status: f.status as DriveFileDTO["status"],
    errorMessage: f.errorMessage,
    records: f.sourceFiles.reduce((sum, sf) => sum + sf.records.length, 0),
  }));

  return (
    <div>
      <h1
        className="mb-5 text-[1.1rem] font-bold"
        style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
      >
        Google Drive
      </h1>
      <DrivePanel
        configured={isGoogleDriveConfigured()}
        folderEnvConfigured={Boolean(getConfiguredFolderId())}
        connection={
          connection
            ? {
                googleEmail: connection.googleEmail,
                folderId: connection.folderId,
                folderName: connection.folderName,
              }
            : null
        }
        files={fileDtos}
        bannerError={sp.error}
        justConnected={sp.connected === "1"}
      />
    </div>
  );
}
