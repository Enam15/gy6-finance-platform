import { ReversalService } from "@/services/reversal-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Reverse a confirmed income entry. Refused if the entry has any payments
 * recorded against it - the payments must be reversed first.
 *
 * On success, posts a mirrored statement-entry group (DR/CR swapped) and
 * marks the income entry's state as REVERSED. 400 on any refusal: not
 * found, no postings (DRAFT), already reversed, payments exist.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const actor = await getActor();
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
  const reason =
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "reason" in body
      ? String((body as { reason?: unknown }).reason ?? "")
      : "";

  const result = await new ReversalService().reverseSource(
    "INCOME_ENTRY",
    id,
    reason,
    {
      actorId: actor?.id ?? null,
      actorLabel: actor?.label ?? null,
    },
  );

  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ reversal: result.value });
}
