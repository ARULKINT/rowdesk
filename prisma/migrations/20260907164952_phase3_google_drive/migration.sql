-- CreateTable
CREATE TABLE "GoogleDriveConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "connectedByUserId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME NOT NULL,
    "folderId" TEXT,
    "folderName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleDriveConnection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriveFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driveFileId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "driveModifiedAt" DATETIME NOT NULL,
    "lastProcessedAt" DATETIME,
    "lastProcessedVersion" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'new',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SourceFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "removedMissingName" INTEGER NOT NULL DEFAULT 0,
    "removedMissingPhone" INTEGER NOT NULL DEFAULT 0,
    "importedVia" TEXT NOT NULL DEFAULT 'manual',
    "driveFileId" TEXT,
    CONSTRAINT "SourceFile_driveFileId_fkey" FOREIGN KEY ("driveFileId") REFERENCES "DriveFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SourceFile" ("filename", "id", "importedAt", "removedMissingName", "removedMissingPhone", "totalRows") SELECT "filename", "id", "importedAt", "removedMissingName", "removedMissingPhone", "totalRows" FROM "SourceFile";
DROP TABLE "SourceFile";
ALTER TABLE "new_SourceFile" RENAME TO "SourceFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GoogleDriveConnection_singleton_key" ON "GoogleDriveConnection"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "DriveFile_driveFileId_key" ON "DriveFile"("driveFileId");

-- CreateIndex
CREATE INDEX "DriveFile_status_idx" ON "DriveFile"("status");
