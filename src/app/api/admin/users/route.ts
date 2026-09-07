import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";
import { parseJsonBody } from "@/lib/validate";
import { createUserSchema } from "@/lib/schemas";

async function requireAdminApi() {
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const [completedCounts, todayCounts, lastSessions] = await Promise.all([
    prisma.record.groupBy({ by: ["doneById"], _count: { _all: true }, where: { doneById: { not: null } } }),
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

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      completed: completedMap.get(u.id) ?? 0,
      completedToday: todayMap.get(u.id) ?? 0,
      lastActive: lastSessionMap.get(u.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const parsed = await parseJsonBody(request, createUserSchema);
  if ("error" in parsed) return parsed.error;
  const { name, username, email, password, role } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, ...(email ? [{ email }] : [])] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that username or email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, username, email: email || null, passwordHash, role },
  });

  await logAudit({
    userId: admin.id,
    action: "user_created",
    entityType: "User",
    entityId: user.id,
    metadata: { name, username, role },
  });

  return NextResponse.json({ id: user.id });
}
