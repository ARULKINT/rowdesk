import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/csrf";
import { STARTER_TEMPLATES } from "@/lib/templates";
import { parseJsonBody } from "@/lib/validate";
import { createDictionarySchema } from "@/lib/schemas";

async function requireAdminApi() {
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const parsed = await parseJsonBody(request, createDictionarySchema);
  if ("error" in parsed) return parsed.error;
  const { name, seedStarters } = parsed.data;

  const dictionaryCount = await prisma.templateDictionary.count();

  const dictionary = await prisma.templateDictionary.create({
    data: {
      name,
      isActive: dictionaryCount === 0, // first dictionary created becomes active automatically
      templates: seedStarters
        ? {
            create: STARTER_TEMPLATES.map((body, i) => ({
              body,
              position: i,
              createdById: admin.id,
            })),
          }
        : undefined,
    },
  });

  await logAudit({
    userId: admin.id,
    action: "dictionary_created",
    entityType: "TemplateDictionary",
    entityId: dictionary.id,
    metadata: { name },
  });

  return NextResponse.json({ id: dictionary.id });
}
