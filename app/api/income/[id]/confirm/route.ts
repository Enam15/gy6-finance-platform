import { IncomeService } from "@/services/income-service";
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
  const { id } = await context.params;
  const result = await new IncomeService().confirm(id);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ entry: result.value });
}
