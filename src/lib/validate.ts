import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/** Parses a Route Handler's JSON body against a Zod schema. Returns either
 * the typed data, or a ready-to-return 400 NextResponse with the first
 * validation issue's message. */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ data: T } | { error: NextResponse }> {
  const raw = await request.json().catch(() => null);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request.";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }
  return { data: result.data };
}
