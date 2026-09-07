"use client";

import { useState } from "react";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't change password.");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setError("Couldn't change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[12px] border-2 p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <h2 className="mb-4 text-[0.85rem] font-bold" style={{ color: "var(--ink)" }}>
        Change password
      </h2>

      <div className="mb-3">
        <label
          className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--ink-muted)" }}
        >
          Current password
        </label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="block w-full rounded-[8px] border-2 p-2.5 text-[0.9rem]"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
      </div>

      <div className="mb-3">
        <label
          className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--ink-muted)" }}
        >
          New password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="block w-full rounded-[8px] border-2 p-2.5 text-[0.9rem]"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
      </div>

      <div className="mb-4">
        <label
          className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--ink-muted)" }}
        >
          Confirm new password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="block w-full rounded-[8px] border-2 p-2.5 text-[0.9rem]"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
      </div>

      {error && (
        <p className="mb-3 text-[0.82rem] font-medium" style={{ color: "var(--accent)" }}>
          {error}
        </p>
      )}
      {success && (
        <p className="mb-3 text-[0.82rem] font-medium" style={{ color: "var(--success)" }}>
          Password updated.
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-[9px] border-2 px-4 py-2.5 text-[0.85rem] font-bold disabled:opacity-50"
        style={{
          borderColor: "var(--border)",
          background: "var(--accent)",
          color: "var(--accent-contrast)",
        }}
      >
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
