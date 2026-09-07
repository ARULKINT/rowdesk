import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";
import { parseJsonBody } from "@/lib/validate";
import { createTemplateSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = await parseJsonBody(request, createTemplateSchema);
  if ("error" in parsed) return parsed.error;
  const { dictionaryId, body: text } = parsed.data;

  const maxPosition = await prisma.template.aggregate({
    where: { dictionaryId },
    _max: { position: true },
  });

  const template = await prisma.template.create({
    data: {
      dictionaryId,
      body: text,
      position: (maxPosition._max.position ?? -1) + 1,
      createdById: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: "template_created",
    entityType: "Template",
    entityId: template.id,
    metadata: { dictionaryId },
  });

  return NextResponse.json({ id: template.id });
}
