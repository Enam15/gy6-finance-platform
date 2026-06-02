import { ReversalService } from "@/services/reversal-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Reverse a balance adjustment. The BalanceAdjustment row remains as
 * historical evidence; the mirrored ledger posting restores the prior
 * balance. Unlike income/expense, there is no "state" to flip on the
 * source record.
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
    "BALANCE_ADJUSTMENT",
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
