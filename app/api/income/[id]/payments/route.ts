import { PaymentService } from "@/services/payment-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Record a payment received against a confirmed income entry. PaymentService
 * atomically posts (DR business account, CR client account), updates the
 * entry's amount_paid / amount_due, and writes the audit log.
 *
 * Errors map to 400 - the most common are: entry not CONFIRMED, payment
 * exceeds amount_due, business account is not in the BUSINESS category.
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
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonResponse(
      { error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  const result = await new PaymentService().recordIncomePayment(
    {
      ...(body as Record<string, unknown>),
      incomeEntryId: id,
    },
    {
      actorId: actor?.id ?? null,
      actorLabel: actor?.label ?? null,
    },
  );

  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ payment: result.value }, { status: 201 });
}
