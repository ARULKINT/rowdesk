import "server-only";
import { prisma } from "@/lib/prisma";
import { STARTER_TEMPLATES } from "@/lib/templates";
import { OUTREACH_STAGES, type OutreachStage } from "@/lib/queue";

export const OUTREACH_LANGUAGES = ["english", "tamil"] as const;
export type OutreachLanguage = (typeof OUTREACH_LANGUAGES)[number];

export type TemplatesByStage = Record<OutreachStage, Record<OutreachLanguage, string[]>>;

function emptyGroups(): TemplatesByStage {
  return {
    initial: { english: [], tamil: [] },
    followup1: { english: [], tamil: [] },
    followup2: { english: [], tamil: [] },
  };
}

/** Templates from the active dictionary, grouped by stage then language, in
 * position order. Falls back to the built-in starters for initial/english
 * only, matching pre-stage behavior when nothing has been configured yet. */
export async function getActiveTemplatesByStage(): Promise<TemplatesByStage> {
  const active = await prisma.templateDictionary.findFirst({
    where: { isActive: true },
    include: {
      templates: {
        where: { status: "active" },
        orderBy: { position: "asc" },
      },
    },
  });

  const grouped = emptyGroups();
  for (const t of active?.templates ?? []) {
    const stage = t.stage as OutreachStage;
    const language = t.language as OutreachLanguage;
    if (grouped[stage] && grouped[stage][language]) {
      grouped[stage][language].push(t.body);
    }
  }

  if (grouped.initial.english.length === 0) {
    grouped.initial.english = STARTER_TEMPLATES;
  }

  return grouped;
}

export { OUTREACH_STAGES };
