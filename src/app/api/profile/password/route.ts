import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser, hashPassword, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";
import { parseJsonBody } from "@/lib/validate";
import { changePasswordSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = await parseJsonBody(request, changePasswordSchema);
  if ("error" in parsed) return parsed.error;
  const { currentPassword, newPassword } = parsed.data;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser || !(await verifyPassword(currentPassword, dbUser.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await logAudit({
    userId: user.id,
    action: "password_changed",
    entityType: "User",
    entityId: user.id,
  });

  return NextResponse.json({ ok: true });
}
