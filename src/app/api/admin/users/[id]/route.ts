import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";
import { parseJsonBody } from "@/lib/validate";
import { editUserSchema } from "@/lib/schemas";

async function requireAdminApi() {
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

async function countActiveAdmins(excludingId?: string) {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
      ...(excludingId ? { id: { not: excludingId } } : {}),
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const parsed = await parseJsonBody(request, editUserSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  if (body.op === "disable" || body.op === "enable") {
    const nextStatus = body.op === "disable" ? "DISABLED" : "ACTIVE";
    if (body.op === "disable" && target.role === "ADMIN") {
      const remaining = await countActiveAdmins(target.id);
      if (remaining === 0) {
        return NextResponse.json(
          { error: "Can't disable the last active admin." },
          { status: 400 }
        );
      }
    }
    await prisma.user.update({ where: { id }, data: { status: nextStatus } });
    await logAudit({
      userId: admin.id,
      action: body.op === "disable" ? "user_disabled" : "user_enabled",
      entityType: "User",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === "role") {
    if (target.role === "ADMIN" && body.role !== "ADMIN") {
      const remaining = await countActiveAdmins(target.id);
      if (remaining === 0) {
        return NextResponse.json(
          { error: "Can't remove the last active admin's role." },
          { status: 400 }
        );
      }
    }
    await prisma.user.update({ where: { id }, data: { role: body.role } });
    await logAudit({
      userId: admin.id,
      action: "role_changed",
      entityType: "User",
      entityId: id,
      metadata: { from: target.role, to: body.role },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === "reset_password") {
    const passwordHash = await hashPassword(body.password);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    await prisma.session.deleteMany({ where: { userId: id } });
    await logAudit({
      userId: admin.id,
      action: "password_reset",
      entityType: "User",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  }

  // op === "edit"
  const name = body.name?.trim() || target.name;
  const email = body.email !== undefined ? body.email.trim() || null : target.email;
  await prisma.user.update({ where: { id }, data: { name, email } });
  await logAudit({
    userId: admin.id,
    action: "user_edited",
    entityType: "User",
    entityId: id,
    metadata: { name, email },
  });
  return NextResponse.json({ ok: true });
}
