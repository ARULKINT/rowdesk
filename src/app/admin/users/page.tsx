import { prisma } from "@/lib/prisma";
import UsersTable, { type AdminUserRow } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const [completedCounts, todayCounts, lastSessions] = await Promise.all([
    prisma.record.groupBy({
      by: ["doneById"],
      _count: { _all: true },
      where: { doneById: { not: null } },
    }),
    prisma.record.groupBy({
      by: ["doneById"],
      _count: { _all: true },
      where: {
        doneById: { not: null },
        doneAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.session.groupBy({ by: ["userId"], _max: { createdAt: true } }),
  ]);

  const completedMap = new Map(completedCounts.map((c) => [c.doneById, c._count._all]));
  const todayMap = new Map(todayCounts.map((c) => [c.doneById, c._count._all]));
  const lastSessionMap = new Map(lastSessions.map((s) => [s.userId, s._max.createdAt]));

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role as "ADMIN" | "DATA_PROCESSOR",
    status: u.status as "ACTIVE" | "DISABLED",
    completed: completedMap.get(u.id) ?? 0,
    completedToday: todayMap.get(u.id) ?? 0,
    lastActive: lastSessionMap.get(u.id)?.toISOString() ?? null,
  }));

  return (
    <div>
      <h1
        className="mb-5 text-[1.1rem] font-bold"
        style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
      >
        Users
      </h1>
      <UsersTable initialUsers={rows} />
    </div>
  );
}
