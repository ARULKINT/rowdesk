import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { connectWithCode } from "@/lib/googleDrive";
import { logAudit } from "@/lib/audit";
import { OAUTH_STATE_COOKIE } from "../connect/route";

export async function GET(request: Request) {
  const admin = await requireAdmin();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  const redirectTo = new URL("/admin/drive", request.url);

  if (oauthError) {
    redirectTo.searchParams.set("error", `Google denied the request: ${oauthError}`);
    return NextResponse.redirect(redirectTo);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    redirectTo.searchParams.set("error", "The connection request expired or was invalid. Try again.");
    return NextResponse.redirect(redirectTo);
  }

  try {
    await connectWithCode(code, admin.id);
    await logAudit({ userId: admin.id, action: "drive_connected", entityType: "GoogleDriveConnection" });
    redirectTo.searchParams.set("connected", "1");
  } catch (err) {
    redirectTo.searchParams.set(
      "error",
      err instanceof Error ? err.message : "Couldn't connect to Google Drive."
    );
  }

  return NextResponse.redirect(redirectTo);
}
