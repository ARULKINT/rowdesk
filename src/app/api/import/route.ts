import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/csrf";
import { importCsvText, type ImportSummary } from "@/lib/csvImport";

export interface ImportFileResult {
  filename: string;
  ok: boolean;
  error?: string;
  summary?: ImportSummary;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const formData = await request.formData();
  const files = formData.getAll("file").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No CSV file was provided." }, { status: 400 });
  }

  let processed = 0;
  let failed = 0;
  const results: ImportFileResult[] = [];

  // Sequential, not parallel — each import does its own multi-row insert, and
  // running several of those concurrently against the same connection pool
  // buys nothing while making partial-failure ordering harder to reason about.
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      failed += 1;
      results.push({ filename: file.name, ok: false, error: "Please upload a .csv file." });
      continue;
    }

    try {
      const text = await file.text();
      const result = await importCsvText(text, file.name, {
        userId: user.id,
        importedVia: "manual",
      });

      if (!result.ok) {
        failed += 1;
        results.push({ filename: file.name, ok: false, error: result.error });
        continue;
      }

      processed += 1;
      results.push({ filename: file.name, ok: true, summary: result.summary });
    } catch (err) {
      failed += 1;
      results.push({
        filename: file.name,
        ok: false,
        error: err instanceof Error ? err.message : "Import failed.",
      });
    }
  }

  return NextResponse.json({ processed, failed, results });
}
