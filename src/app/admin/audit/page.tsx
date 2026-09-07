import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const userId = sp.userId || "";
  const action = sp.action || "";
  const q = sp.q || "";
  const page = Math.max(1, Number(sp.page) || 1);

  const [users, actions] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  const where = {
    ...(userId ? { userId } : {}),
    ...(action ? { action } : {}),
    ...(q
      ? {
          OR: [
            { entityType: { contains: q } },
            { entityId: { contains: q } },
            { metadata: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams({ userId, action, q, page: String(p) });
    return `/admin/audit?${params.toString()}`;
  }

  return (
    <div>
      <h1
        className="mb-5 text-[1.1rem] font-bold"
        style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
      >
        Audit Log
      </h1>

      <form
        method="get"
        className="mb-5 flex flex-wrap items-center gap-3 rounded-[10px] border-2 p-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <select name="userId" defaultValue={userId} className="rounded-[7px] border-2 p-2 text-[0.82rem]" style={inputStyle}>
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select name="action" defaultValue={action} className="rounded-[7px] border-2 p-2 text-[0.82rem]" style={inputStyle}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a.action} value={a.action}>
              {a.action}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search entity / metadata…"
          className="rounded-[7px] border-2 p-2 text-[0.82rem]"
          style={inputStyle}
        />
        <button
          type="submit"
          className="rounded-[7px] border-2 px-3 py-2 text-[0.8rem] font-bold"
          style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          Filter
        </button>
      </form>

      <div
        className="overflow-x-auto rounded-[10px] border-2"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <table className="w-full min-w-[720px] text-left text-[0.82rem]">
          <thead>
            <tr
              style={{
                color: "var(--ink-muted)",
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <th className="px-3 py-2.5 font-semibold">Time</th>
              <th className="py-2.5 font-semibold">User</th>
              <th className="py-2.5 font-semibold">Action</th>
              <th className="py-2.5 font-semibold">Entity</th>
              <th className="py-2.5 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-data-stack)" }}>
                  {e.createdAt.toLocaleString()}
                </td>
                <td className="py-2.5">{e.user?.name ?? "System"}</td>
                <td className="py-2.5" style={{ fontFamily: "var(--font-data-stack)" }}>
                  {e.action}
                </td>
                <td className="py-2.5" style={{ color: "var(--ink-muted)" }}>
                  {e.entityType}
                  {e.entityId ? ` #${e.entityId.slice(0, 8)}` : ""}
                </td>
                <td className="py-2.5 max-w-[280px] truncate" style={{ color: "var(--ink-muted)", fontSize: "0.76rem" }}>
                  {e.metadata ?? ""}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center" style={{ color: "var(--ink-muted)" }}>
                  No matching audit entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-2 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
          {page > 1 && (
            <a href={pageHref(page - 1)} style={{ color: "var(--accent)" }}>
              ← Newer
            </a>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={pageHref(page + 1)} style={{ color: "var(--accent)" }}>
              Older →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
