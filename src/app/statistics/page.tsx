import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dailyCounts } from "@/lib/stats";
import { nowMs } from "@/lib/time";
import AppHeader from "@/components/AppHeader";
import StatCard from "@/components/StatCard";
import SimpleBarChart from "@/components/SimpleBarChart";

export const dynamic = "force-dynamic";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function MyStatisticsPage() {
  const user = await requireUser();

  const startOfToday = daysAgo(0);
  const sevenDaysAgo = daysAgo(6);
  const thirtyDaysAgo = daysAgo(29);
  const fourteenDaysAgo = daysAgo(13);

  const [myCompleted, completedToday, completedThisWeek, completedThisMonth, skippedCount, availableInQueue, recentDone] =
    await Promise.all([
      prisma.record.count({ where: { doneById: user.id } }),
      prisma.record.count({ where: { doneById: user.id, doneAt: { gte: startOfToday } } }),
      prisma.record.count({ where: { doneById: user.id, doneAt: { gte: sevenDaysAgo } } }),
      prisma.record.count({ where: { doneById: user.id, doneAt: { gte: thirtyDaysAgo } } }),
      prisma.auditLog.count({
        where: { userId: user.id, action: "record_skipped", createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.record.count({ where: { status: { in: ["pending", "skipped"] }, claimedById: null } }),
      prisma.record.findMany({
        where: { doneById: user.id, doneAt: { gte: fourteenDaysAgo } },
        select: { doneAt: true },
      }),
    ]);

  const hoursSinceMidnight = Math.max((nowMs() - startOfToday.getTime()) / 3_600_000, 1 / 6);
  const avgPerHour = completedToday > 0 ? completedToday / hoursSinceMidnight : 0;

  const chartData = dailyCounts(
    recentDone.map((r) => r.doneAt!).filter(Boolean),
    14
  );

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <AppHeader user={user} />
      <div className="mx-auto w-full max-w-[1000px] px-5 py-6">
        <h1
          className="mb-5 text-[1.1rem] font-bold"
          style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
        >
          My Statistics
        </h1>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="My Completed" value={myCompleted} />
          <StatCard label="Completed Today" value={completedToday} accent />
          <StatCard label="Completed This Week" value={completedThisWeek} />
          <StatCard label="Completed This Month" value={completedThisMonth} />
          <StatCard label="Avg / Hour" value={avgPerHour.toFixed(1)} />
          <StatCard label="Skipped (30d)" value={skippedCount} />
          <StatCard label="Available In Queue" value={availableInQueue} />
        </div>

        <div
          className="rounded-[12px] border-2 p-5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div
            className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.05em]"
            style={{ color: "var(--ink-muted)" }}
          >
            Completed per day (last 14 days)
          </div>
          <SimpleBarChart data={chartData} />
        </div>
      </div>
    </div>
  );
}
