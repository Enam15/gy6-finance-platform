import { RenewalService } from "@/services/renewal-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Pause or reactivate a renewal template. A paused (isActive=false) template
 * is skipped by "Generate due renewals", so no further drafts are produced
 * until it is reactivated.
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

  const isActive = (body as { isActive?: unknown })?.isActive;
  if (typeof isActive !== "boolean") {
    return jsonResponse(
      { error: "isActive (boolean) is required" },
      { status: 400 },
    );
  }

  const result = await new RenewalService().setActive(id, isActive, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 404 });
  }
  return jsonResponse({ template: result.value });
}
