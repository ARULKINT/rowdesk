import { prisma } from "@/lib/prisma";
import DictionariesPanel, { type DictionaryDTO } from "./DictionariesPanel";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const dictionaries = await prisma.templateDictionary.findMany({
    orderBy: { createdAt: "asc" },
    include: { templates: { orderBy: { position: "asc" } } },
  });

  const data: DictionaryDTO[] = dictionaries.map((d) => ({
    id: d.id,
    name: d.name,
    isActive: d.isActive,
    templates: d.templates.map((t) => ({
      id: t.id,
      body: t.body,
      position: t.position,
      status: t.status as "active" | "retired",
    })),
  }));

  return (
    <div>
      <h1
        className="mb-2 text-[1.1rem] font-bold"
        style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
      >
        Template Dictionaries
      </h1>
      <p className="mb-5 text-[0.85rem]" style={{ color: "var(--ink-muted)" }}>
        The active dictionary’s active templates populate the outreach composer on the Dashboard.
        Only one dictionary can be active at a time.
      </p>
      <DictionariesPanel initialDictionaries={data} />
    </div>
  );
}
