import { AccountService } from "@/services/account-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * The adjust-balance switch sends nothing but its own flag. Anything else is
 * an edit of the account's details, which the service validates.
 */
function isAdjustToggle(body: unknown): body is { allowBalanceAdjust: boolean } {
  if (typeof body !== "object" || body === null) return false;
  const keys = Object.keys(body);
  return (
    keys.length === 1 &&
    keys[0] === "allowBalanceAdjust" &&
    typeof (body as { allowBalanceAdjust: unknown }).allowBalanceAdjust ===
      "boolean"
  );
}

/**
 * Edit an account, or toggle whether its "Adjust balance" action is offered.
 * Neither path can reach the balance itself - that only moves by posting an
 * adjustment through the ledger.
 */
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

  const service = new AccountService();
  const actorOptions = {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  };

  if (isAdjustToggle(body)) {
    const result = await service.setBalanceAdjustable(
      id,
      body.allowBalanceAdjust,
      actorOptions,
    );
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

  const result = await service.updateAccount(id, body, actorOptions);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({
    account: { id: result.value.id, name: result.value.name },
  });
}
