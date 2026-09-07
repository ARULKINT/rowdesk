"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import CleaningSummary from "@/components/CleaningSummary";

interface ImportResult {
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

export default function AdminImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong importing this file.");
        return;
      }

      setResult(data);
      setTimeout(() => router.push("/admin/queue"), 2400);
    } catch {
      setError("Something went wrong importing this file.");
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
          CSV file
        </label>
        <p className="mb-3 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
          Expected columns: name, phone, rating, maps_url, website_url — differently-named
          columns are detected automatically. Name and Phone are required on each row; rows
          missing either are removed. Rating, Maps URL and Website may be blank.
        </p>

        <input
          ref={inputRef}
          id="csvFile"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
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
          {busy ? "Importing…" : "Import"}
        </button>

        {fileName && !result && (
          <p className="mt-3 text-[0.78rem]" style={{ color: "var(--ink-muted)" }}>
            Selected: {fileName}
          </p>
        )}

        {error && (
          <p className="mt-3 text-[0.85rem] font-medium" style={{ color: "var(--accent)" }}>
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4">
            <p className="mb-3 text-[0.85rem] font-medium" style={{ color: "var(--success)" }}>
              Imported {result.imported} of {result.totalRows} rows. Opening the queue…
            </p>
            <CleaningSummary
              data={{
                totalRows: result.totalRows,
                removedMissingName: result.removedMissingName,
                removedMissingPhone: result.removedMissingPhone,
                finalRows: result.imported,
                missingRating: result.missingRating,
                missingMapsUrl: result.missingMapsUrl,
                missingWebsite: result.missingWebsite,
              }}
            />
          </div>
        )}
      </form>
    </div>
  );
}
