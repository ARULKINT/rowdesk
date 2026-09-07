"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SettingsData } from "@/lib/settings";

const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
};

export default function SettingsForm({ initialSettings }: { initialSettings: SettingsData }) {
  const router = useRouter();
  const [claimTimeoutMinutes, setClaimTimeoutMinutes] = useState(
    initialSettings.claimTimeoutMinutes
  );
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimTimeoutMinutes, timezone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save settings.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Couldn't save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-[480px] rounded-[12px] border-2 p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-4">
        <label
          className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--ink-muted)" }}
        >
          Processing lock timeout (minutes)
        </label>
        <p className="mb-2 text-[0.78rem]" style={{ color: "var(--ink-muted)" }}>
          A record claimed by a user and not completed within this time is automatically
          returned to the shared queue.
        </p>
        <input
          type="number"
          min={1}
          value={claimTimeoutMinutes}
          onChange={(e) => setClaimTimeoutMinutes(Number(e.target.value))}
          className="w-32 rounded-[8px] border-2 p-2.5 text-[0.9rem]"
          style={inputStyle}
        />
      </div>

      <div className="mb-4">
        <label
          className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--ink-muted)" }}
        >
          Application timezone
        </label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="e.g. Asia/Kolkata"
          className="w-full rounded-[8px] border-2 p-2.5 text-[0.9rem]"
          style={inputStyle}
        />
      </div>

      {error && (
        <p className="mb-3 text-[0.82rem] font-medium" style={{ color: "var(--accent)" }}>
          {error}
        </p>
      )}
      {success && (
        <p className="mb-3 text-[0.82rem] font-medium" style={{ color: "var(--success)" }}>
          Settings saved.
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-[9px] border-2 px-4 py-2.5 text-[0.85rem] font-bold disabled:opacity-50"
        style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
