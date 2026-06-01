import { ExpenseService } from "@/services/expense-service";
import { jsonResponse } from "@/lib/json";

/**
 * Confirm a DRAFT expense entry: posts (DR Expense, CR payee account)
 * through the ledger and marks the entry CONFIRMED, atomically. 400 if the
 * entry is not DRAFT or the posting was refused.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const result = await new ExpenseService().confirm(id);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ entry: result.value });
}
