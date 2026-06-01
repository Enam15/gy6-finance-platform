import { TransactionCategoryService } from "@/services/transaction-category-service";
import { jsonResponse } from "@/lib/json";

/**
 * Transaction-category list + create. Categories are the labels users attach
 * to income and expense entries ("Project Fee", "Salary", "Software").
 */

export async function GET(): Promise<Response> {
  const categories = await new TransactionCategoryService().listAll();
  return jsonResponse({ categories });
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

  const result = await new TransactionCategoryService().create(body);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ category: result.value }, { status: 201 });
}
