"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export interface AdminUserRow {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: "ADMIN" | "DATA_PROCESSOR";
  status: "ACTIVE" | "DISABLED";
  completed: number;
  completedToday: number;
  lastActive: string | null;
}

const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
};

async function patchUser(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "DATA_PROCESSOR">("DATA_PROCESSOR");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create user.");
        return;
      }
      setName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("DATA_PROCESSOR");
      setOpen(false);
      onCreated();
    } catch {
      setError("Couldn't create user.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 rounded-[8px] border-2 px-4 py-2 text-[0.82rem] font-bold"
        style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        + Create user
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-[10px] border-2 p-4 sm:grid-cols-2 lg:grid-cols-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <input
        placeholder="Full name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-[7px] border-2 p-2 text-[0.85rem]"
        style={inputStyle}
      />
      <input
        placeholder="Username"
        required
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="rounded-[7px] border-2 p-2 text-[0.85rem]"
        style={inputStyle}
      />
      <input
        placeholder="Email (optional)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-[7px] border-2 p-2 text-[0.85rem]"
        style={inputStyle}
      />
      <input
        placeholder="Temporary password"
        type="text"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-[7px] border-2 p-2 text-[0.85rem]"
        style={inputStyle}
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "ADMIN" | "DATA_PROCESSOR")}
        className="rounded-[7px] border-2 p-2 text-[0.85rem]"
        style={inputStyle}
      >
        <option value="DATA_PROCESSOR">Data Processor</option>
        <option value="ADMIN">Admin</option>
      </select>

      <div className="col-span-full flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-[7px] border-2 px-4 py-2 text-[0.82rem] font-bold disabled:opacity-50"
          style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          {busy ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-[7px] border-2 px-4 py-2 text-[0.82rem] font-semibold"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
        >
          Cancel
        </button>
        {error && (
          <span className="text-[0.8rem] font-medium" style={{ color: "var(--accent)" }}>
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

function UserRow({ user }: { user: AdminUserRow }) {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr style={{ borderTop: "1px solid var(--border-soft)" }}>
      <td className="py-2.5 pr-3">
        <div style={{ fontWeight: 600 }}>{user.name}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", fontFamily: "var(--font-data-stack)" }}>
          {user.username}
        </div>
      </td>
      <td className="py-2.5 pr-3">
        <select
          value={user.role}
          disabled={busy}
          onChange={(e) => run(() => patchUser(user.id, { op: "role", role: e.target.value }))}
          className="rounded-[6px] border-2 p-1.5 text-[0.78rem]"
          style={inputStyle}
        >
          <option value="DATA_PROCESSOR">Data Processor</option>
          <option value="ADMIN">Admin</option>
        </select>
      </td>
      <td className="py-2.5 pr-3">
        <span
          className="rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase"
          style={{
            background: user.status === "ACTIVE" ? "var(--success-soft)" : "var(--chip)",
            color: user.status === "ACTIVE" ? "var(--success)" : "var(--ink-muted)",
          }}
        >
          {user.status === "ACTIVE" ? "Active" : "Disabled"}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-[0.85rem]" style={{ fontFamily: "var(--font-data-stack)" }}>
        {user.completed}
      </td>
      <td className="py-2.5 pr-3 text-[0.85rem]" style={{ fontFamily: "var(--font-data-stack)" }}>
        {user.completedToday}
      </td>
      <td className="py-2.5 pr-3 text-[0.78rem]" style={{ color: "var(--ink-muted)" }}>
        {user.lastActive ? new Date(user.lastActive).toLocaleString() : "Never"}
      </td>
      <td className="py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                patchUser(user.id, { op: user.status === "ACTIVE" ? "disable" : "enable" })
              )
            }
            className="rounded-[6px] border-2 px-2 py-1 text-[0.72rem] font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            {user.status === "ACTIVE" ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            onClick={() => setResetting((v) => !v)}
            className="rounded-[6px] border-2 px-2 py-1 text-[0.72rem] font-semibold"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            Reset password
          </button>
          <Link
            href={`/admin/audit?userId=${user.id}`}
            className="rounded-[6px] border-2 px-2 py-1 text-[0.72rem] font-semibold"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            Activity
          </Link>
        </div>
        {resetting && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="New password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-[6px] border-2 p-1.5 text-[0.78rem]"
              style={inputStyle}
            />
            <button
              type="button"
              disabled={busy || newPassword.length < 8}
              onClick={() =>
                run(async () => {
                  await patchUser(user.id, { op: "reset_password", password: newPassword });
                  setNewPassword("");
                  setResetting(false);
                })
              }
              className="rounded-[6px] border-2 px-2 py-1 text-[0.72rem] font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Set
            </button>
          </div>
        )}
        {error && (
          <div className="mt-1 text-[0.72rem] font-medium" style={{ color: "var(--accent)" }}>
            {error}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function UsersTable({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const router = useRouter();

  return (
    <div>
      <CreateUserForm onCreated={() => router.refresh()} />

      <div
        className="overflow-x-auto rounded-[10px] border-2"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <table className="w-full min-w-[720px] text-left text-[0.85rem]">
          <thead>
            <tr
              style={{
                color: "var(--ink-muted)",
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <th className="px-3 py-2.5 font-semibold">Name</th>
              <th className="px-0 py-2.5 font-semibold">Role</th>
              <th className="px-0 py-2.5 font-semibold">Status</th>
              <th className="px-0 py-2.5 font-semibold">Completed</th>
              <th className="px-0 py-2.5 font-semibold">Today</th>
              <th className="px-0 py-2.5 font-semibold">Last Active</th>
              <th className="px-0 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
