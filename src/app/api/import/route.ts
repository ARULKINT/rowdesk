import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/csrf";
import { importCsvText } from "@/lib/csvImport";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No CSV file was provided." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Please upload a .csv file." }, { status: 400 });
  }

  const text = await file.text();
  const result = await importCsvText(text, file.name, {
    userId: user.id,
    importedVia: "manual",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.summary);
}
