-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "outreachStage" TEXT NOT NULL DEFAULT 'initial',
ADD COLUMN     "stageDueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'english',
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'initial';

-- CreateIndex
CREATE INDEX "Record_stageDueAt_idx" ON "Record"("stageDueAt");

-- CreateIndex
CREATE INDEX "Template_dictionaryId_stage_language_idx" ON "Template"("dictionaryId", "stage", "language");
