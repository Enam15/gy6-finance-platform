import { ExpenseService } from "@/services/expense-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Expense list + draft create. Drafts do not touch the ledger - confirming
 * them is a separate action (POST /api/expenses/[id]/confirm) that posts
 * double-entry and marks the entry CONFIRMED atomically.
 */

export async function GET(): Promise<Response> {
  const entries = await new ExpenseService().listEntries();
  return jsonResponse({ entries });
}

export async function POST(request: Request): Promise<Response> {
  const actor = await getActor();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const result = await new ExpenseService().createDraft(body, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ entry: result.value }, { status: 201 });
}
