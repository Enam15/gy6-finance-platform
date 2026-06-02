import { IncomeService } from "@/services/income-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Confirm a DRAFT income entry: posts (DR client account, CR Revenue) through
 * the ledger and marks the entry CONFIRMED, atomically. 400 if the entry is
 * not DRAFT or the posting was refused.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const actor = await getActor();
  const { id } = await context.params;
  const result = await new IncomeService().confirm(id, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ entry: result.value });
}
