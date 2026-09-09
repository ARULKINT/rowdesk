"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import CleaningSummary from "@/components/CleaningSummary";

interface ImportSummary {
  sourceFileId: string;
  filename: string;
  totalRows: number;
  imported: number;
  removedMissingName: number;
  removedMissingPhone: number;
  missingRating: number;
  missingMapsUrl: number;
  missingWebsite: number;
}

interface FileResult {
  filename: string;
  ok: boolean;
  error?: string;
  summary?: ImportSummary;
}

interface ImportResponse {
  processed: number;
  failed: number;
  results: FileResult[];
}

export default function AdminImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ImportResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const files = inputRef.current?.files;
    if (!files || files.length === 0) {
      setError("Choose at least one CSV file first.");
      return;
    }

    setBusy(true);
    setError(null);
    setResponse(null);

    try {
      const formData = new FormData();
      for (const file of Array.from(files)) formData.append("file", file);

      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong importing these files.");
        return;
      }

      setResponse(data as ImportResponse);
      // Only auto-jump to the queue when every file succeeded — if something
      // failed, keep the results on screen so the errors are actually seen.
      if (data.failed === 0) {
        setTimeout(() => router.push("/admin/queue"), 2400);
      }
    } catch {
      setError("Something went wrong importing these files.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[780px]">
      <h1
        className="mb-4 text-[1.1rem] font-bold"
        style={{ fontFamily: "var(--font-display-stack)", color: "var(--ink)" }}
      >
        Import CSV
      </h1>

      <form
        onSubmit={handleSubmit}
        className="rounded-[12px] border-2 p-6"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <label
          htmlFor="csvFile"
          className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--ink-muted)" }}
        >
          CSV file(s)
        </label>
        <p className="mb-3 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
          Expected columns: name, phone, rating, maps_url, website_url — differently-named
          columns are detected automatically. Name and Phone are required on each row; rows
          missing either (or with an unusable phone number) are removed. Rating, Maps URL and
          Website may be blank. Select multiple files to import them all in one go.
        </p>

        <input
          ref={inputRef}
          id="csvFile"
          type="file"
          accept=".csv,text/csv"
          multiple
          onChange={(e) => setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))}
          className="mb-4 block w-full rounded-[8px] border-2 p-2.5 text-[0.9rem]"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />

        <button
          type="submit"
          disabled={busy}
          className="rounded-[9px] border-2 px-4 py-3 text-[0.88rem] font-bold disabled:opacity-50"
          style={{
            borderColor: "var(--border)",
            background: "var(--accent)",
            color: "var(--accent-contrast)",
          }}
        >
          {busy
            ? "Importing…"
            : fileNames.length > 1
            ? `Import ${fileNames.length} files`
            : "Import"}
        </button>

        {fileNames.length > 0 && !response && (
          <p className="mt-3 text-[0.78rem]" style={{ color: "var(--ink-muted)" }}>
            Selected: {fileNames.join(", ")}
          </p>
        )}

        {error && (
          <p className="mt-3 text-[0.85rem] font-medium" style={{ color: "var(--accent)" }}>
            {error}
          </p>
        )}

        {response && (
          <div className="mt-4 flex flex-col gap-4">
            <p
              className="text-[0.85rem] font-medium"
              style={{ color: response.failed === 0 ? "var(--success)" : "var(--ink)" }}
            >
              {response.processed} of {response.processed + response.failed} file
              {response.processed + response.failed === 1 ? "" : "s"} imported
              {response.failed > 0 ? `, ${response.failed} failed` : ""}.
              {response.failed === 0 ? " Opening the queue…" : ""}
            </p>

            {response.results.map((r, i) => (
              <div key={`${r.filename}-${i}`}>
                <p
                  className="mb-2 text-[0.8rem] font-semibold"
                  style={{ color: r.ok ? "var(--ink)" : "var(--accent)" }}
                >
                  {r.filename} — {r.ok ? "imported" : `failed: ${r.error}`}
                </p>
                {r.ok && r.summary && (
                  <CleaningSummary
                    data={{
                      totalRows: r.summary.totalRows,
                      removedMissingName: r.summary.removedMissingName,
                      removedMissingPhone: r.summary.removedMissingPhone,
                      finalRows: r.summary.imported,
                      missingRating: r.summary.missingRating,
                      missingMapsUrl: r.summary.missingMapsUrl,
                      missingWebsite: r.summary.missingWebsite,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
