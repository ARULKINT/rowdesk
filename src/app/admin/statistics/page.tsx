import { prisma } from "@/lib/prisma";
import { dailyCounts } from "@/lib/stats";
import { nowMs } from "@/lib/time";
import { OUTREACH_STAGES, type OutreachStage } from "@/lib/queue";
import StatCard from "@/components/StatCard";
import SimpleBarChart from "@/components/SimpleBarChart";

const STAGE_LABEL: Record<OutreachStage, string> = {
  initial: "Initial",
  followup1: "Follow-up 1",
  followup2: "Follow-up 2",
};

// Stages a record has moved past once it's this far along — e.g. a record
// at followup2 has completed both initial and followup1.
const STAGES_PAST: Record<OutreachStage, string[]> = {
  initial: ["followup1", "followup2", "finished"],
  followup1: ["followup2", "finished"],
  followup2: ["finished"],
};

export const dynamic = "force-dynamic";

const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
};

function resolveRange(range: string, from?: string, to?: string): { gte: Date; lte: Date } {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  switch (range) {
    case "yesterday": {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 1);
      const end = new Date(startOfToday);
      return { gte: start, lte: end };
    }
    case "7d": {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 6);
      return { gte: start, lte: now };
    }
    case "custom": {
      return {
        gte: from ? new Date(from) : new Date(0),
        lte: to ? new Date(to) : now,
      };
    }
    case "30d":
    default: {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 29);
      return { gte: start, lte: now };
    }
  }
}

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const range = sp.range || "30d";
  const userId = sp.userId || "";
  const fileId = sp.fileId || "";
  const dateRange = resolveRange(range, sp.from, sp.to);

  const [users, files] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.sourceFile.findMany({ orderBy: { filename: "asc" } }),
  ]);

  const recordScope = fileId ? { sourceFileId: fileId } : {};

  const [totalRecords, completed, pending, inProgress, skipped, fileAgg, missingRating, missingMapsUrl, missingWebsite] =
    await Promise.all([
      prisma.record.count({ where: recordScope }),
      prisma.record.count({ where: { ...recordScope, status: "done" } }),
      prisma.record.count({ where: { ...recordScope, status: "pending", claimedById: null } }),
      prisma.record.count({
        where: { ...recordScope, status: { in: ["pending", "skipped"] }, claimedById: { not: null } },
      }),
      prisma.record.count({ where: { ...recordScope, status: "skipped", claimedById: null } }),
      prisma.sourceFile.aggregate({
        where: fileId ? { id: fileId } : {},
        _sum: { removedMissingName: true, removedMissingPhone: true },
      }),
      prisma.record.count({ where: { ...recordScope, rating: null } }),
      prisma.record.count({ where: { ...recordScope, mapsUrl: null } }),
      prisma.record.count({ where: { ...recordScope, websiteUrl: null } }),
    ]);

  const removed = (fileAgg._sum.removedMissingName ?? 0) + (fileAgg._sum.removedMissingPhone ?? 0);

  const now = new Date();
  const [stageCounts, fullyDone] = await Promise.all([
    Promise.all(
      OUTREACH_STAGES.map(async (stage) => {
        const [pendingNow, inProcess, completedPast] = await Promise.all([
          prisma.record.count({
            where: {
              ...recordScope,
              outreachStage: stage,
              status: { in: ["pending", "skipped"] },
              OR: [{ stageDueAt: null }, { stageDueAt: { lte: now } }],
            },
          }),
          prisma.record.count({
            where: { ...recordScope, outreachStage: stage, stageDueAt: { gt: now } },
          }),
          prisma.record.count({
            where: { ...recordScope, outreachStage: { in: STAGES_PAST[stage] } },
          }),
        ]);
        return { stage, pendingNow, inProcess, completedPast };
      })
    ),
    prisma.record.count({ where: { ...recordScope, outreachStage: "finished" } }),
  ]);

  const doneInRange = await prisma.record.findMany({
    where: {
      ...recordScope,
      ...(userId ? { doneById: userId } : {}),
      status: "done",
      doneAt: { gte: dateRange.gte, lte: dateRange.lte },
    },
    select: { doneAt: true, doneById: true },
  });

  const numDays = range === "yesterday" ? 1 : range === "7d" ? 7 : range === "custom" ? 30 : 30;
  const chartData = dailyCounts(doneInRange.map((r) => r.doneAt!).filter(Boolean), numDays);

  const completedByUser = new Map<string, number>();
  for (const r of doneInRange) {
    if (!r.doneById) continue;
    completedByUser.set(r.doneById, (completedByUser.get(r.doneById) ?? 0) + 1);
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [todayByUser, lastSessions] = await Promise.all([
    prisma.record.groupBy({
      by: ["doneById"],
      _count: { _all: true },
      where: { doneById: { not: null }, doneAt: { gte: startOfToday } },
    }),
    prisma.session.groupBy({ by: ["userId"], _max: { createdAt: true } }),
  ]);
  const todayMap = new Map(todayByUser.map((c) => [c.doneById, c._count._all]));
  const lastActiveMap = new Map(lastSessions.map((s) => [s.userId, s._max.createdAt]));

  return (
    <div>
      <h1
        className="mb-5 text-[1.1rem] font-bold"
        style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
      >
        Statistics
      </h1>

      <form
        method="get"
        className="mb-6 flex flex-wrap items-center gap-3 rounded-[10px] border-2 p-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <select name="range" defaultValue={range} className="rounded-[7px] border-2 p-2 text-[0.82rem]" style={inputStyle}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>
        <input type="date" name="from" defaultValue={sp.from} className="rounded-[7px] border-2 p-2 text-[0.82rem]" style={inputStyle} />
        <input type="date" name="to" defaultValue={sp.to} className="rounded-[7px] border-2 p-2 text-[0.82rem]" style={inputStyle} />
        <select name="userId" defaultValue={userId} className="rounded-[7px] border-2 p-2 text-[0.82rem]" style={inputStyle}>
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select name="fileId" defaultValue={fileId} className="rounded-[7px] border-2 p-2 text-[0.82rem]" style={inputStyle}>
          <option value="">All source files</option>
          {files.map((f) => (
            <option key={f.id} value={f.id}>
              {f.filename}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-[7px] border-2 px-3 py-2 text-[0.8rem] font-bold"
          style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          Apply
        </button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Records" value={totalRecords} />
        <StatCard label="Completed" value={completed} accent />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Removed" value={removed} />
        <StatCard label="In Progress" value={inProgress} />
        <StatCard label="Skipped" value={skipped} />
      </div>

      <h2 className="mb-2 text-[0.85rem] font-bold" style={{ color: "var(--ink)" }}>
        Outreach stage breakdown
      </h2>
      <div
        className="mb-6 overflow-x-auto rounded-[10px] border-2"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <table className="w-full min-w-[560px] text-left text-[0.82rem]">
          <thead>
            <tr
              style={{
                color: "var(--ink-muted)",
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <th className="px-3 py-2.5 font-semibold">Stage</th>
              <th className="py-2.5 font-semibold">Pending (ready now)</th>
              <th className="py-2.5 font-semibold">In Process (3-day wait)</th>
              <th className="py-2.5 font-semibold">Completed (moved past)</th>
            </tr>
          </thead>
          <tbody>
            {stageCounts.map(({ stage, pendingNow, inProcess, completedPast }) => (
              <tr key={stage} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td className="px-3 py-2.5 font-medium">{STAGE_LABEL[stage]}</td>
                <td className="py-2.5" style={{ fontFamily: "var(--font-data-stack)" }}>
                  {pendingNow}
                </td>
                <td className="py-2.5" style={{ fontFamily: "var(--font-data-stack)" }}>
                  {inProcess}
                </td>
                <td className="py-2.5" style={{ fontFamily: "var(--font-data-stack)" }}>
                  {completedPast}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Fully Done (all 3 stages)" value={fullyDone} accent />
      </div>

      <div
        className="mb-6 rounded-[12px] border-2 p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div
          className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.05em]"
          style={{ color: "var(--ink-muted)" }}
        >
          Records completed per day (selected range)
        </div>
        <SimpleBarChart data={chartData} />
      </div>

      <h2 className="mb-2 text-[0.85rem] font-bold" style={{ color: "var(--ink)" }}>
        User performance
      </h2>
      <div
        className="mb-6 overflow-x-auto rounded-[10px] border-2"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <table className="w-full min-w-[600px] text-left text-[0.82rem]">
          <thead>
            <tr
              style={{
                color: "var(--ink-muted)",
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <th className="px-3 py-2.5 font-semibold">User</th>
              <th className="py-2.5 font-semibold">Completed (range)</th>
              <th className="py-2.5 font-semibold">Completed Today</th>
              <th className="py-2.5 font-semibold">Avg / Hour</th>
              <th className="py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const lastActive = lastActiveMap.get(u.id);
              const isActive = lastActive && nowMs() - lastActive.getTime() < 15 * 60 * 1000;
              const completedRange = completedByUser.get(u.id) ?? 0;
              const today = todayMap.get(u.id) ?? 0;
              const hoursSinceMidnight = Math.max((nowMs() - startOfToday.getTime()) / 3_600_000, 1 / 6);
              return (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td className="px-3 py-2.5 font-medium">{u.name}</td>
                  <td className="py-2.5" style={{ fontFamily: "var(--font-data-stack)" }}>
                    {completedRange}
                  </td>
                  <td className="py-2.5" style={{ fontFamily: "var(--font-data-stack)" }}>
                    {today}
                  </td>
                  <td className="py-2.5" style={{ fontFamily: "var(--font-data-stack)" }}>
                    {(today / hoursSinceMidnight).toFixed(1)}
                  </td>
                  <td className="py-2.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[0.68rem] font-semibold uppercase"
                      style={{
                        background: isActive ? "var(--success-soft)" : "var(--chip)",
                        color: isActive ? "var(--success)" : "var(--ink-muted)",
                      }}
                    >
                      {isActive ? "Active" : "Idle"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-[0.85rem] font-bold" style={{ color: "var(--ink)" }}>
        Data quality
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Missing Rating" value={missingRating} />
        <StatCard label="Missing GMap URL" value={missingMapsUrl} />
        <StatCard label="Missing Website" value={missingWebsite} />
        <StatCard label="Removed — Missing Name" value={fileAgg._sum.removedMissingName ?? 0} />
        <StatCard label="Removed — Missing Phone" value={fileAgg._sum.removedMissingPhone ?? 0} />
      </div>
    </div>
  );
}
