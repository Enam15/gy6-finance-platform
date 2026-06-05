import { RenewalService } from "@/services/renewal-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Generate DRAFT entries for every renewal template due as of today.
 * Catch-up: a template overdue by several periods produces one correctly-
 * dated draft per missed period (bounded per run). Drafts never post -
 * the user confirms them like any manually entered draft.
 *
 * Returns a summary: { totalCreated, templates: [{ templateId,
 * templateName, kind, entriesCreated }] }.
 */
export async function POST(): Promise<Response> {
  const actor = await getActor();

  const result = await new RenewalService().generateDue({
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ summary: result.value });
}
