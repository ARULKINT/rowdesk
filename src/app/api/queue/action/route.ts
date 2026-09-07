import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import {
  claimNextRecordForUser,
  completeRecord,
  OwnershipError,
  releaseRecord,
  skipRecord,
} from "@/lib/queue";
import { isSameOrigin } from "@/lib/csrf";
import { parseJsonBody } from "@/lib/validate";
import { queueActionSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = await parseJsonBody(request, queueActionSchema);
  if ("error" in parsed) return parsed.error;
  const { recordId, action } = parsed.data;

  try {
    if (action === "skip") await skipRecord(recordId, user.id);
    else if (action === "done") await completeRecord(recordId, user.id);
    else await releaseRecord(recordId, user.id);
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const next = await claimNextRecordForUser(user.id, { excludeRecordId: recordId });
  return NextResponse.json({ record: next });
}
