-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "rating" REAL,
    "mapsUrl" TEXT,
    "websiteUrl" TEXT,
    "called" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "outreachStage" TEXT NOT NULL DEFAULT 'initial',
    "stageDueAt" DATETIME,
    "claimedById" TEXT,
    "claimedAt" DATETIME,
    "doneById" TEXT,
    "doneAt" DATETIME,
    "sourceFileId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Record_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Record" ("called", "claimedAt", "claimedById", "createdAt", "doneAt", "doneById", "id", "mapsUrl", "name", "phone", "rating", "rowIndex", "sourceFileId", "status", "updatedAt", "verified", "websiteUrl") SELECT "called", "claimedAt", "claimedById", "createdAt", "doneAt", "doneById", "id", "mapsUrl", "name", "phone", "rating", "rowIndex", "sourceFileId", "status", "updatedAt", "verified", "websiteUrl" FROM "Record";
DROP TABLE "Record";
ALTER TABLE "new_Record" RENAME TO "Record";
CREATE INDEX "Record_sourceFileId_rowIndex_idx" ON "Record"("sourceFileId", "rowIndex");
CREATE INDEX "Record_status_claimedById_idx" ON "Record"("status", "claimedById");
CREATE INDEX "Record_claimedAt_idx" ON "Record"("claimedAt");
CREATE INDEX "Record_stageDueAt_idx" ON "Record"("stageDueAt");
CREATE TABLE "new_Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dictionaryId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "stage" TEXT NOT NULL DEFAULT 'initial',
    "language" TEXT NOT NULL DEFAULT 'english',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Template_dictionaryId_fkey" FOREIGN KEY ("dictionaryId") REFERENCES "TemplateDictionary" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Template_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Template" ("body", "createdAt", "createdById", "dictionaryId", "id", "position", "status", "updatedAt") SELECT "body", "createdAt", "createdById", "dictionaryId", "id", "position", "status", "updatedAt" FROM "Template";
DROP TABLE "Template";
ALTER TABLE "new_Template" RENAME TO "Template";
CREATE INDEX "Template_dictionaryId_position_idx" ON "Template"("dictionaryId", "position");
CREATE INDEX "Template_dictionaryId_stage_language_idx" ON "Template"("dictionaryId", "stage", "language");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
