import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";
import { parseJsonBody } from "@/lib/validate";
import { loginSchema } from "@/lib/schemas";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const ipLimit = rateLimit(`login:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const parsed = await parseJsonBody(request, loginSchema);
  if ("error" in parsed) return parsed.error;
  const { identifier, password } = parsed.data;

  const identifierLimit = rateLimit(`login:id:${identifier.toLowerCase()}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!identifierLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts for this account. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await logAudit({
      userId: user?.id ?? null,
      action: "login_failed",
      entityType: "User",
      entityId: user?.id ?? null,
      metadata: { identifier },
    });
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "This account has been disabled. Contact an admin." },
      { status: 403 }
    );
  }

  await createSession(user.id);
  await logAudit({ userId: user.id, action: "login", entityType: "User", entityId: user.id });

  return NextResponse.json({
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
  });
}
