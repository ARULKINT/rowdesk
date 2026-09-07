import "server-only";
import { prisma } from "@/lib/prisma";
import { STARTER_TEMPLATES } from "@/lib/templates";

/** Templates from the active dictionary, in order. Falls back to the
 * built-in starters if no dictionary has been activated yet. */
export async function getActiveTemplateBodies(): Promise<string[]> {
  const active = await prisma.templateDictionary.findFirst({
    where: { isActive: true },
    include: {
      templates: {
        where: { status: "active" },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!active || active.templates.length === 0) return STARTER_TEMPLATES;
  return active.templates.map((t) => t.body);
}
