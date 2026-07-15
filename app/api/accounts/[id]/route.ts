import { AccountService } from "@/services/account-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/** Toggle whether the "Adjust balance" action is offered for an account. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
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

  const allow = (body as { allowBalanceAdjust?: unknown })?.allowBalanceAdjust;
  if (typeof allow !== "boolean") {
    return jsonResponse(
      { error: "allowBalanceAdjust (boolean) is required" },
      { status: 400 },
    );
  }

  const result = await new AccountService().setBalanceAdjustable(id, allow, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({
    account: {
      id: result.value.id,
      allowBalanceAdjust: result.value.allowBalanceAdjust,
    },
  });
}
