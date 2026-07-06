import { AccountService } from "@/services/account-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/** Create a user-defined account category (with optional custom fields). */
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

  const result = await new AccountService().createCategory(body, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ category: result.value }, { status: 201 });
}
