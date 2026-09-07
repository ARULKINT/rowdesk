import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/csrf";
import { parseJsonBody } from "@/lib/validate";
import { recordPatchSchema } from "@/lib/schemas";

/**
 * Toggles Called/Verified on the caller's currently-claimed record only.
 * Status transitions (skip/done/next) go through /api/queue/action instead,
 * since those also move the claim and need to be audited.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.record.findUnique({ where: { id } });
  if (!existing || existing.claimedById !== user.id) {
    return NextResponse.json(
      { error: "This record is no longer assigned to you." },
      { status: 409 }
    );
  }

  const parsed = await parseJsonBody(request, recordPatchSchema);
  if ("error" in parsed) return parsed.error;

  const record = await prisma.record.update({ where: { id }, data: parsed.data });
  return NextResponse.json(record);
}
