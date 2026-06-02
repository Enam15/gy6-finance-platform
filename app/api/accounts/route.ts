import { AccountService } from "@/services/account-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Account list + create. Reads use the AccountService directly inside server
 * components; this route exists for the client-side create flow and any
 * future programmatic access. Money fields are BigInt and are emitted as
 * decimal strings via the shared json helper.
 */

export async function GET(): Promise<Response> {
  const accounts = await new AccountService().listVisible();
  return jsonResponse({ accounts });
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

  const result = await new AccountService().createAccount(body, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ account: result.value }, { status: 201 });
}
