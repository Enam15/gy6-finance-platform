import { IncomeService } from "@/services/income-service";
import { jsonResponse } from "@/lib/json";

/**
 * Income list + draft create. Drafts do not touch the ledger - confirming
 * them is a separate action (POST /api/income/[id]/confirm) that posts
 * double-entry and marks the entry CONFIRMED atomically.
 */

export async function GET(): Promise<Response> {
  const entries = await new IncomeService().listEntries();
  return jsonResponse({ entries });
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

  const result = await new IncomeService().createDraft(body);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ entry: result.value }, { status: 201 });
}
