import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";
import { parseJsonBody } from "@/lib/validate";
import { editTemplateSchema } from "@/lib/schemas";

export async function PATCH(
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
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  const parsed = await parseJsonBody(request, editTemplateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  if (body.op === "edit") {
    await prisma.template.update({ where: { id }, data: { body: body.body } });
    await logAudit({ userId: user.id, action: "template_edited", entityType: "Template", entityId: id });
    return NextResponse.json({ ok: true });
  }

  if (body.op === "retire" || body.op === "restore") {
    await prisma.template.update({
      where: { id },
      data: { status: body.op === "retire" ? "retired" : "active" },
    });
    await logAudit({
      userId: user.id,
      action: body.op === "retire" ? "template_retired" : "template_restored",
      entityType: "Template",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  }

  // op === "move"
  const siblings = await prisma.template.findMany({
    where: { dictionaryId: template.dictionaryId },
    orderBy: { position: "asc" },
  });
  const idx = siblings.findIndex((t) => t.id === id);
  const swapIdx = body.direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) {
    return NextResponse.json({ ok: true });
  }
  const other = siblings[swapIdx];
  await prisma.$transaction([
    prisma.template.update({ where: { id: template.id }, data: { position: other.position } }),
    prisma.template.update({ where: { id: other.id }, data: { position: template.position } }),
  ]);
  return NextResponse.json({ ok: true });
}
