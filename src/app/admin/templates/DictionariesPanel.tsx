"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface TemplateDTO {
  id: string;
  body: string;
  position: number;
  status: "active" | "retired";
}

export interface DictionaryDTO {
  id: string;
  name: string;
  isActive: boolean;
  templates: TemplateDTO[];
}

const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
};

async function post(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

async function patch(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function TemplateRow({ template }: { template: TemplateDTO }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(template.body);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-[8px] border-2 p-3"
      style={{
        borderColor: "var(--border-soft)",
        background: template.status === "retired" ? "var(--chip)" : "var(--surface)",
        opacity: template.status === "retired" ? 0.7 : 1,
      }}
    >
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full rounded-[6px] border-2 p-2 text-[0.85rem]"
            style={inputStyle}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await patch(`/api/admin/templates/${template.id}`, { op: "edit", body });
                  setEditing(false);
                })
              }
              className="rounded-[6px] border-2 px-3 py-1 text-[0.75rem] font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setBody(template.body);
                setEditing(false);
              }}
              className="rounded-[6px] border-2 px-3 py-1 text-[0.75rem] font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-2 whitespace-pre-wrap text-[0.85rem]" style={{ color: "var(--ink)" }}>
            {template.body}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="rounded-[6px] border-2 px-2 py-1 text-[0.72rem] font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() =>
                  patch(`/api/admin/templates/${template.id}`, {
                    op: template.status === "active" ? "retire" : "restore",
                  })
                )
              }
              className="rounded-[6px] border-2 px-2 py-1 text-[0.72rem] font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              {template.status === "active" ? "Retire" : "Restore"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => patch(`/api/admin/templates/${template.id}`, { op: "move", direction: "up" }))}
              className="rounded-[6px] border-2 px-2 py-1 text-[0.72rem] font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => patch(`/api/admin/templates/${template.id}`, { op: "move", direction: "down" }))}
              className="rounded-[6px] border-2 px-2 py-1 text-[0.72rem] font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              ↓
            </button>
            <span
              className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase"
              style={{
                background: template.status === "active" ? "var(--success-soft)" : "var(--accent-soft)",
                color: template.status === "active" ? "var(--success)" : "var(--accent)",
              }}
            >
              {template.status}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function AddTemplateForm({ dictionaryId }: { dictionaryId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await post("/api/admin/templates", { dictionaryId, body });
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
      <textarea
        placeholder="New template message — use {domain} for the record's domain, {name} for the business name"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        className="w-full rounded-[6px] border-2 p-2 text-[0.85rem]"
        style={inputStyle}
      />
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-[6px] border-2 px-3 py-1.5 text-[0.78rem] font-semibold disabled:opacity-50"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
      >
        + Add template
      </button>
    </form>
  );
}

function DictionaryCard({ dictionary }: { dictionary: DictionaryDTO }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true);
    try {
      await post(`/api/admin/dictionaries/${dictionary.id}/activate`, {});
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-[10px] border-2 p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[0.95rem] font-bold" style={{ color: "var(--ink)" }}>
          {dictionary.name}
        </h2>
        {dictionary.isActive ? (
          <span
            className="rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase"
            style={{ background: "var(--success-soft)", color: "var(--success)" }}
          >
            Active
          </span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={activate}
            className="rounded-[6px] border-2 px-2.5 py-1 text-[0.72rem] font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            Set active
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {dictionary.templates.length === 0 && (
          <p className="text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
            No templates yet.
          </p>
        )}
        {dictionary.templates.map((t) => (
          <TemplateRow key={t.id} template={t} />
        ))}
      </div>

      <AddTemplateForm dictionaryId={dictionary.id} />
    </div>
  );
}

function CreateDictionaryForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [seedStarters, setSeedStarters] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await post("/api/admin/dictionaries", { name, seedStarters });
      setName("");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[8px] border-2 px-4 py-2 text-[0.82rem] font-bold"
        style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        + Create dictionary
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-3 rounded-[10px] border-2 p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <input
        placeholder="Dictionary name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-[7px] border-2 p-2 text-[0.85rem]"
        style={inputStyle}
      />
      <label className="flex items-center gap-1.5 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
        <input
          type="checkbox"
          checked={seedStarters}
          onChange={(e) => setSeedStarters(e.target.checked)}
        />
        Seed with 3 starter templates
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-[7px] border-2 px-3 py-1.5 text-[0.8rem] font-bold disabled:opacity-50"
        style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        Create
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-[7px] border-2 px-3 py-1.5 text-[0.8rem] font-semibold"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
      >
        Cancel
      </button>
    </form>
  );
}

export default function DictionariesPanel({
  initialDictionaries,
}: {
  initialDictionaries: DictionaryDTO[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <CreateDictionaryForm />
      {initialDictionaries.map((d) => (
        <DictionaryCard key={d.id} dictionary={d} />
      ))}
    </div>
  );
}
