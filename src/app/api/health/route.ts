import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Minimal liveness/readiness probe for uptime monitoring (Vercel, UptimeRobot,
 * etc.) — confirms the app is serving and the database is reachable. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
