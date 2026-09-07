"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Couldn't sign in.");
        setBusy(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't sign in. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[380px]">
        <div className="mb-6 text-center">
          <span
            className="text-[1.4rem] font-extrabold tracking-[-0.01em]"
            style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
          >
            Rowdesk
          </span>
          <div
            className="mt-1 text-[0.72rem] uppercase tracking-[0.08em]"
            style={{ fontFamily: "var(--font-data-stack)", color: "var(--ink-muted)" }}
          >
            Lead Queue
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[14px] border-2 p-7"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="mb-4">
            <label
              htmlFor="identifier"
              className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--ink-muted)" }}
            >
              Username or email
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="block w-full rounded-[8px] border-2 p-2.5 text-[0.95rem]"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
              required
            />
          </div>

          <div className="mb-5">
            <label
              htmlFor="password"
              className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--ink-muted)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-[8px] border-2 p-2.5 text-[0.95rem]"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
              required
            />
          </div>

          {error && (
            <p
              className="mb-4 text-[0.82rem] font-medium"
              style={{ color: "var(--accent)" }}
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[9px] border-2 py-3 text-[0.9rem] font-bold disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              background: "var(--accent)",
              color: "var(--accent-contrast)",
            }}
          >
            {busy ? "Signing in…" : "Login"}
          </button>
        </form>

        <p
          className="mt-4 text-center text-[0.76rem]"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-data-stack)" }}
        >
          Forgot your password? Ask an admin to reset it.
        </p>
      </div>
    </div>
  );
}
