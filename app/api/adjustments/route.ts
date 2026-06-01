import { BalanceAdjustmentService } from "@/services/balance-adjustment-service";
import { jsonResponse } from "@/lib/json";

/**
 * Manual balance corrections. The service computes (newBalance -
 * previousBalance) inside a transaction (with the target account row
 * locked) and posts the difference through the ledger against the
 * Adjustments system account. A no-op (difference == 0) is refused.
 */

export async function GET(): Promise<Response> {
  const adjustments = await new BalanceAdjustmentService().listAll();
  return jsonResponse({ adjustments });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const result = await new BalanceAdjustmentService().createAdjustment(body);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ adjustment: result.value }, { status: 201 });
}
