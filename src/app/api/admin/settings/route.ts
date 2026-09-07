import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";
import { setSetting } from "@/lib/settings";
import { parseJsonBody } from "@/lib/validate";
import { settingsSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = await parseJsonBody(request, settingsSchema);
  if ("error" in parsed) return parsed.error;
  const { claimTimeoutMinutes, timezone } = parsed.data;

  await setSetting("claimTimeoutMinutes", String(Math.round(claimTimeoutMinutes)));
  await setSetting("timezone", timezone);

  await logAudit({
    userId: user.id,
    action: "settings_changed",
    entityType: "SystemSetting",
    metadata: { claimTimeoutMinutes, timezone },
  });

  return NextResponse.json({ ok: true });
}
