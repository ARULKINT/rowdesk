import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;

  await prisma.$transaction([
    prisma.templateDictionary.updateMany({ data: { isActive: false }, where: { isActive: true } }),
    prisma.templateDictionary.update({ where: { id }, data: { isActive: true } }),
  ]);

  await logAudit({
    userId: user.id,
    action: "dictionary_activated",
    entityType: "TemplateDictionary",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
