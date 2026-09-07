import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { generateAuthUrl, isGoogleDriveConfigured } from "@/lib/googleDrive";

export const OAUTH_STATE_COOKIE = "rowdesk_drive_oauth_state";

export async function GET(request: Request) {
  await requireAdmin();

  if (!isGoogleDriveConfigured()) {
    const url = new URL("/admin/drive", request.url);
    url.searchParams.set(
      "error",
      "Google Drive isn't configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI."
    );
    return NextResponse.redirect(url);
  }

  const state = randomBytes(24).toString("hex");
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(generateAuthUrl(state));
}
