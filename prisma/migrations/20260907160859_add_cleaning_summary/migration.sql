-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SourceFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "removedMissingName" INTEGER NOT NULL DEFAULT 0,
    "removedMissingPhone" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_SourceFile" ("filename", "id", "importedAt") SELECT "filename", "id", "importedAt" FROM "SourceFile";
DROP TABLE "SourceFile";
ALTER TABLE "new_SourceFile" RENAME TO "SourceFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
