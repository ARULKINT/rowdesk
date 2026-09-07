import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { disconnectDrive } from "@/lib/googleDrive";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  await disconnectDrive();
  await logAudit({ userId: user.id, action: "drive_disconnected", entityType: "GoogleDriveConnection" });

  return NextResponse.json({ ok: true });
}
