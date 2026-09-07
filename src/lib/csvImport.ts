import "server-only";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { mapColumns, rowToRecord } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

export interface ImportSummary {
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

export type ImportResult = { ok: true; summary: ImportSummary } | { ok: false; error: string };

/**
 * Shared cleaning + persistence pipeline for both manual CSV upload and
 * Google Drive imports, so the two paths can never drift apart.
 */
export async function importCsvText(
  text: string,
  filename: string,
  options: {
    userId: string | null;
    importedVia?: "manual" | "drive";
    driveFileId?: string;
  }
): Promise<ImportResult> {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    return { ok: false, error: `Couldn't parse this CSV: ${parsed.errors[0].message}` };
  }

  const headers = parsed.meta.fields ?? [];
  const { mapping, missingRequired } = mapColumns(headers);

  if (missingRequired.length > 0) {
    return {
      ok: false,
      error: `Couldn't find a "${missingRequired.join(
        '", "'
      )}" column in this CSV. Columns found: ${headers.join(", ") || "(none)"}.`,
    };
  }

  const results = parsed.data.map((row) => rowToRecord(row, mapping));
  const rows = results
    .filter((r) => r.ok)
    .map((r) => (r as Extract<typeof r, { ok: true }>).record);
  const removedMissingName = results.filter((r) => !r.ok && r.reason === "missing_name").length;
  const removedMissingPhone = results.filter(
    (r) => !r.ok && r.reason === "missing_phone"
  ).length;

  if (rows.length === 0) {
    return { ok: false, error: "No usable rows found — every row was missing a Name or Phone." };
  }

  const sourceFile = await prisma.sourceFile.create({
    data: {
      filename,
      totalRows: parsed.data.length,
      removedMissingName,
      removedMissingPhone,
      importedVia: options.importedVia ?? "manual",
      driveFileId: options.driveFileId,
    },
  });

  await prisma.record.createMany({
    data: rows.map((r, i) => ({
      sourceFileId: sourceFile.id,
      rowIndex: i,
      name: r.name,
      phone: r.phone,
      rating: r.rating,
      mapsUrl: r.mapsUrl,
      websiteUrl: r.websiteUrl,
    })),
  });

  const missingRating = rows.filter((r) => r.rating == null).length;
  const missingMapsUrl = rows.filter((r) => !r.mapsUrl).length;
  const missingWebsite = rows.filter((r) => !r.websiteUrl).length;

  await logAudit({
    userId: options.userId,
    action: "csv_imported",
    entityType: "SourceFile",
    entityId: sourceFile.id,
    metadata: {
      filename,
      totalRows: parsed.data.length,
      imported: rows.length,
      removedMissingName,
      removedMissingPhone,
      importedVia: options.importedVia ?? "manual",
    },
  });

  return {
    ok: true,
    summary: {
      sourceFileId: sourceFile.id,
      filename,
      totalRows: parsed.data.length,
      imported: rows.length,
      removedMissingName,
      removedMissingPhone,
      missingRating,
      missingMapsUrl,
      missingWebsite,
    },
  };
}
