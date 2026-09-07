import Link from "next/link";
import { prisma } from "@/lib/prisma";
import StatCard from "@/components/StatCard";
import CleaningSummary from "@/components/CleaningSummary";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  const [pending, claimed, completed, skippedUnclaimed, files, inProgress, recentlyDone] =
    await Promise.all([
      prisma.record.count({ where: { status: "pending", claimedById: null } }),
      prisma.record.count({ where: { status: { in: ["pending", "skipped"] }, claimedById: { not: null } } }),
      prisma.record.count({ where: { status: "done" } }),
      prisma.record.count({ where: { status: "skipped", claimedById: null } }),
      prisma.sourceFile.findMany({
        orderBy: { importedAt: "desc" },
        include: { _count: { select: { records: true } } },
      }),
      prisma.record.findMany({
        where: { claimedById: { not: null }, status: { in: ["pending", "skipped"] } },
        include: { claimedBy: true, sourceFile: true },
        orderBy: { claimedAt: "asc" },
        take: 50,
      }),
      prisma.record.findMany({
        where: { status: "done" },
        include: { doneBy: true, sourceFile: true },
        orderBy: { doneAt: "desc" },
        take: 20,
      }),
    ]);

  const statusByFile = await prisma.record.groupBy({
    by: ["sourceFileId", "status"],
    _count: { _all: true },
  });
  const fileStats = new Map<string, { done: number; pending: number; skipped: number }>();
  for (const row of statusByFile) {
    const entry = fileStats.get(row.sourceFileId) ?? { done: 0, pending: 0, skipped: 0 };
    if (row.status === "done") entry.done += row._count._all;
    if (row.status === "pending") entry.pending += row._count._all;
    if (row.status === "skipped") entry.skipped += row._count._all;
    fileStats.set(row.sourceFileId, entry);
  }

  const totals = files.reduce(
    (acc, f) => ({
      totalRows: acc.totalRows + f.totalRows,
      removedMissingName: acc.removedMissingName + f.removedMissingName,
      removedMissingPhone: acc.removedMissingPhone + f.removedMissingPhone,
      finalRows: acc.finalRows + f._count.records,
    }),
    { totalRows: 0, removedMissingName: 0, removedMissingPhone: 0, finalRows: 0 }
  );

  const [missingRating, missingMapsUrl, missingWebsite] = await Promise.all([
    prisma.record.count({ where: { rating: null } }),
    prisma.record.count({ where: { mapsUrl: null } }),
    prisma.record.count({ where: { websiteUrl: null } }),
  ]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1
          className="text-[1.1rem] font-bold"
          style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
        >
          Processing Queue
        </h1>
        <div className="flex gap-2">
          <a
            href="/api/admin/export"
            className="rounded-[8px] border-2 px-3 py-2 text-[0.78rem] font-semibold"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            Export processed CSV
          </a>
          <Link
            href="/admin/import"
            className="rounded-[8px] border-2 px-3 py-2 text-[0.78rem] font-bold"
            style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            Import CSV
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending" value={pending} />
        <StatCard label="Claimed" value={claimed} accent />
        <StatCard label="Completed" value={completed} />
        <StatCard label="Skipped" value={skippedUnclaimed} />
      </div>

      <div className="mb-6">
        <CleaningSummary
          data={{
            totalRows: totals.totalRows,
            removedMissingName: totals.removedMissingName,
            removedMissingPhone: totals.removedMissingPhone,
            finalRows: totals.finalRows,
            missingRating,
            missingMapsUrl,
            missingWebsite,
          }}
        />
      </div>

      <h2 className="mb-2 text-[0.85rem] font-bold" style={{ color: "var(--ink)" }}>
        Source files
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
              <th className="px-3 py-2.5 font-semibold">Filename</th>
              <th className="py-2.5 font-semibold">Imported</th>
              <th className="py-2.5 font-semibold">Rows</th>
              <th className="py-2.5 font-semibold">Done</th>
              <th className="py-2.5 font-semibold">Pending</th>
              <th className="py-2.5 font-semibold">Skipped</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => {
              const s = fileStats.get(f.id) ?? { done: 0, pending: 0, skipped: 0 };
              return (
                <tr key={f.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td className="px-3 py-2.5 font-medium">{f.filename}</td>
                  <td className="py-2.5" style={{ color: "var(--ink-muted)" }}>
                    {f.importedAt.toLocaleDateString()}
                  </td>
                  <td className="py-2.5" style={{ fontFamily: "var(--font-data-stack)" }}>
                    {f._count.records}
                  </td>
                  <td className="py-2.5" style={{ color: "var(--success)" }}>
                    {s.done}
                  </td>
                  <td className="py-2.5">{s.pending}</td>
                  <td className="py-2.5" style={{ color: "var(--accent)" }}>
                    {s.skipped}
                  </td>
                </tr>
              );
            })}
            {files.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--ink-muted)" }}>
                  No files imported yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-[0.85rem] font-bold" style={{ color: "var(--ink)" }}>
        Currently claimed ({inProgress.length})
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
              <th className="px-3 py-2.5 font-semibold">Record</th>
              <th className="py-2.5 font-semibold">Source File</th>
              <th className="py-2.5 font-semibold">Assigned User</th>
              <th className="py-2.5 font-semibold">Status</th>
              <th className="py-2.5 font-semibold">Claimed At</th>
            </tr>
          </thead>
          <tbody>
            {inProgress.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td className="px-3 py-2.5 font-medium">{r.name}</td>
                <td className="py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {r.sourceFile.filename}
                </td>
                <td className="py-2.5">{r.claimedBy?.name ?? "—"}</td>
                <td className="py-2.5">{r.status}</td>
                <td className="py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {r.claimedAt ? new Date(r.claimedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {inProgress.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center" style={{ color: "var(--ink-muted)" }}>
                  Nothing is currently claimed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-[0.85rem] font-bold" style={{ color: "var(--ink)" }}>
        Recently completed
      </h2>
      <div
        className="overflow-x-auto rounded-[10px] border-2"
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
              <th className="px-3 py-2.5 font-semibold">Record</th>
              <th className="py-2.5 font-semibold">Source File</th>
              <th className="py-2.5 font-semibold">Completed By</th>
              <th className="py-2.5 font-semibold">Completed At</th>
            </tr>
          </thead>
          <tbody>
            {recentlyDone.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td className="px-3 py-2.5 font-medium">{r.name}</td>
                <td className="py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {r.sourceFile.filename}
                </td>
                <td className="py-2.5">{r.doneBy?.name ?? "—"}</td>
                <td className="py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {r.doneAt ? new Date(r.doneAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {recentlyDone.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--ink-muted)" }}>
                  Nothing completed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
