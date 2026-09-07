import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { claimNextRecordForUser } from "@/lib/queue";
import { isSameOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const record = await claimNextRecordForUser(user.id);
  return NextResponse.json({ record });
}
