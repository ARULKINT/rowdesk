"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import StatCard from "@/components/StatCard";

export interface DriveFileDTO {
  id: string;
  filename: string;
  driveModifiedAt: string;
  lastProcessedAt: string | null;
  status: "new" | "updated" | "unchanged" | "processing" | "processed" | "error";
  errorMessage: string | null;
  records: number;
}

export interface ConnectionDTO {
  googleEmail: string;
  folderId: string | null;
  folderName: string | null;
}

const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
};

const STATUS_COLORS: Record<DriveFileDTO["status"], { bg: string; fg: string }> = {
  new: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  updated: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  unchanged: { bg: "var(--chip)", fg: "var(--ink-muted)" },
  processing: { bg: "var(--chip)", fg: "var(--ink-muted)" },
  processed: { bg: "var(--success-soft)", fg: "var(--success)" },
  error: { bg: "#f6d0cd", fg: "#a5291c" },
};

async function post(url: string, body?: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function ConnectionCard({ connection, configured }: { connection: ConnectionDTO | null; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await post("/api/admin/drive/disconnect");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div
        className="mb-6 rounded-[12px] border-2 p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <p className="mb-2 font-semibold" style={{ color: "var(--ink)" }}>
          Google Drive isn’t configured yet
        </p>
        <p className="text-[0.85rem]" style={{ color: "var(--ink-muted)" }}>
          Set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> and{" "}
          <code>GOOGLE_REDIRECT_URI</code> in your environment (an OAuth client from Google Cloud
          Console, with the redirect URI registered as{" "}
          <code>&lt;your app URL&gt;/api/admin/drive/callback</code>), then reload this page.
        </p>
      </div>
    );
  }

  if (!connection) {
    return (
      <div
        className="mb-6 rounded-[12px] border-2 p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <p className="mb-3 text-[0.85rem]" style={{ color: "var(--ink-muted)" }}>
          Not connected.
        </p>
        <a
          href="/api/admin/drive/connect"
          className="inline-block rounded-[9px] border-2 px-4 py-2.5 text-[0.85rem] font-bold"
          style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          Connect Google Drive
        </a>
      </div>
    );
  }

  return (
    <div
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-2 p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--success)" }}
            aria-hidden="true"
          />
          <span className="font-semibold" style={{ color: "var(--ink)" }}>
            Connected
          </span>
        </div>
        <p className="mt-1 text-[0.82rem]" style={{ color: "var(--ink-muted)" }}>
          {connection.googleEmail}
          {connection.folderName ? ` · Folder: ${connection.folderName}` : " · No folder selected"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-[0.78rem] font-medium" style={{ color: "var(--accent)" }}>
            {error}
          </span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={disconnect}
          className="rounded-[8px] border-2 px-3 py-2 text-[0.78rem] font-semibold disabled:opacity-50"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

function FolderForm({ connection }: { connection: ConnectionDTO }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/admin/drive/folder", { folder: value });
      setValue("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify that folder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 flex flex-wrap items-center gap-3 rounded-[12px] border-2 p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex-1 min-w-[240px]">
        <label
          className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--ink-muted)" }}
        >
          Source folder
        </label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={connection.folderName ? `Currently: ${connection.folderName}` : "Folder ID or Drive link"}
          className="w-full rounded-[8px] border-2 p-2.5 text-[0.85rem]"
          style={inputStyle}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-[8px] border-2 px-4 py-2.5 text-[0.82rem] font-bold disabled:opacity-50"
        style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        {busy ? "Verifying…" : connection.folderId ? "Change folder" : "Set folder"}
      </button>
      {error && (
        <span className="w-full text-[0.78rem] font-medium" style={{ color: "var(--accent)" }}>
          {error}
        </span>
      )}
    </form>
  );
}

function ActionsBar({ hasFolder }: { hasFolder: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"scan" | "process" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function scan() {
    setBusy("scan");
    setError(null);
    setMessage(null);
    try {
      const data = await post("/api/admin/drive/scan");
      setMessage(
        `Scan complete — ${data.totalFound} CSV file(s) found (${data.created} new, ${data.updated} updated, ${data.unchanged} unchanged).`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setBusy(null);
    }
  }

  async function process() {
    setBusy("process");
    setError(null);
    setMessage(null);
    try {
      const data = await post("/api/admin/drive/process");
      setMessage(`Processed ${data.processed} file(s)${data.failed > 0 ? `, ${data.failed} failed` : ""}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={!hasFolder || busy !== null}
        onClick={scan}
        className="rounded-[9px] border-2 px-4 py-2.5 text-[0.85rem] font-bold disabled:opacity-50"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
      >
        {busy === "scan" ? "Scanning…" : "Scan Drive"}
      </button>
      <button
        type="button"
        disabled={!hasFolder || busy !== null}
        onClick={process}
        className="rounded-[9px] border-2 px-4 py-2.5 text-[0.85rem] font-bold disabled:opacity-50"
        style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        {busy === "process" ? "Processing…" : "Process New & Updated"}
      </button>
      {message && (
        <span className="text-[0.82rem] font-medium" style={{ color: "var(--success)" }}>
          {message}
        </span>
      )}
      {error && (
        <span className="text-[0.82rem] font-medium" style={{ color: "var(--accent)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

export default function DrivePanel({
  configured,
  connection,
  files,
  bannerError,
  justConnected,
}: {
  configured: boolean;
  connection: ConnectionDTO | null;
  files: DriveFileDTO[];
  bannerError?: string;
  justConnected?: boolean;
}) {
  const counts = files.reduce(
    (acc, f) => {
      acc.total += 1;
      acc[f.status] = (acc[f.status] ?? 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>
  );

  return (
    <div>
      {bannerError && (
        <div
          className="mb-5 rounded-[10px] border-2 p-3 text-[0.82rem] font-medium"
          style={{ borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {bannerError}
        </div>
      )}
      {justConnected && !bannerError && (
        <div
          className="mb-5 rounded-[10px] border-2 p-3 text-[0.82rem] font-medium"
          style={{ borderColor: "var(--success)", background: "var(--success-soft)", color: "var(--success)" }}
        >
          Google Drive connected.
        </div>
      )}

      <ConnectionCard connection={connection} configured={configured} />

      {connection && <FolderForm connection={connection} />}

      {connection?.folderId && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total files" value={counts.total ?? 0} />
            <StatCard label="New" value={counts.new ?? 0} accent />
            <StatCard label="Updated" value={counts.updated ?? 0} accent />
            <StatCard label="Unchanged" value={counts.unchanged ?? 0} />
            <StatCard label="Processing" value={counts.processing ?? 0} />
            <StatCard label="Errors" value={counts.error ?? 0} />
          </div>

          <ActionsBar hasFolder={Boolean(connection.folderId)} />

          <div
            className="overflow-x-auto rounded-[10px] border-2"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <table className="w-full min-w-[720px] text-left text-[0.82rem]">
              <thead>
                <tr
                  style={{
                    color: "var(--ink-muted)",
                    fontSize: "0.68rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <th className="px-3 py-2.5 font-semibold">Filename</th>
                  <th className="py-2.5 font-semibold">Last Modified</th>
                  <th className="py-2.5 font-semibold">Last Processed</th>
                  <th className="py-2.5 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold">Records</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const c = STATUS_COLORS[f.status];
                  return (
                    <tr key={f.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                      <td className="px-3 py-2.5 font-medium">{f.filename}</td>
                      <td className="py-2.5" style={{ color: "var(--ink-muted)" }}>
                        {new Date(f.driveModifiedAt).toLocaleString()}
                      </td>
                      <td className="py-2.5" style={{ color: "var(--ink-muted)" }}>
                        {f.lastProcessedAt ? new Date(f.lastProcessedAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-2.5">
                        <span
                          className="rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase"
                          style={{ background: c.bg, color: c.fg }}
                          title={f.status === "error" ? f.errorMessage ?? "" : undefined}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="py-2.5" style={{ fontFamily: "var(--font-data-stack)" }}>
                        {f.records}
                      </td>
                    </tr>
                  );
                })}
                {files.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center" style={{ color: "var(--ink-muted)" }}>
                      No files found yet — click Scan Drive.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
