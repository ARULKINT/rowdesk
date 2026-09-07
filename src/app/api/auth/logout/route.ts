import { NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const user = await getSessionUser();
  await destroySession();
  if (user) {
    await logAudit({ userId: user.id, action: "logout", entityType: "User", entityId: user.id });
  }
  return NextResponse.json({ ok: true });
}
