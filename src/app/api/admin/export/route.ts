import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || undefined;
  const fileId = searchParams.get("fileId") || undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const records = await prisma.record.findMany({
    where: {
      status: "done",
      ...(userId ? { doneById: userId } : {}),
      ...(fileId ? { sourceFileId: fileId } : {}),
      ...(from || to
        ? {
            doneAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { sourceFile: true, doneBy: true },
    orderBy: { doneAt: "desc" },
  });

  const header = [
    "Name",
    "Google Maps URL",
    "Phone",
    "Average Rating",
    "Website",
    "User ID",
    "Processed Timestamp",
    "Source File",
    "Source File ID",
    "Source Row ID",
  ];

  const lines = [header.join(",")];
  for (const r of records) {
    lines.push(
      [
        csvCell(r.name),
        csvCell(r.mapsUrl),
        csvCell(r.phone),
        csvCell(r.rating),
        csvCell(r.websiteUrl),
        csvCell(r.doneById),
        csvCell(r.doneAt?.toISOString()),
        csvCell(r.sourceFile.filename),
        csvCell(r.sourceFileId),
        csvCell(r.rowIndex),
      ].join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rowdesk-processed-${Date.now()}.csv"`,
    },
  });
}
