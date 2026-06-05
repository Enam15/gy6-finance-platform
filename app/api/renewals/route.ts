import { RenewalService } from "@/services/renewal-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Renewal-template list + create. Templates are recipes; creating one does
 * not generate anything. Generation is a separate action
 * (POST /api/renewals/generate) that materialises DRAFT entries.
 */

export async function GET(): Promise<Response> {
  const templates = await new RenewalService().listTemplates();
  return jsonResponse({ templates });
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

  const result = await new RenewalService().createTemplate(body, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ template: result.value }, { status: 201 });
}
