import { requireUser } from "@/lib/auth";
import { claimNextRecordForUser, type OutreachStage } from "@/lib/queue";
import { getActiveTemplatesByStage } from "@/lib/templateDictionary";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import RowdeskScreen from "@/components/RowdeskScreen";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const [record, templatesByStage] = await Promise.all([
    claimNextRecordForUser(user.id),
    getActiveTemplatesByStage(),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const doneToday = await prisma.record.count({
    where: { doneById: user.id, doneAt: { gte: startOfToday } },
  });

  const recordDto = record
    ? {
        id: record.id,
        rowIndex: record.rowIndex,
        name: record.name,
        phone: record.phone,
        rating: record.rating,
        mapsUrl: record.mapsUrl,
        websiteUrl: record.websiteUrl,
        called: record.called,
        verified: record.verified,
        status: record.status as "pending" | "done" | "skipped",
        outreachStage: record.outreachStage as OutreachStage,
        fileName: record.sourceFile.filename,
        totalInFile: record.totalInFile,
      }
    : null;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <AppHeader user={user} />
      <RowdeskScreen
        initialRecord={recordDto}
        initialDoneToday={doneToday}
        templatesByStage={templatesByStage}
      />
    </div>
  );
}
