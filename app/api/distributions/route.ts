import { DistributionService } from "@/services/distribution-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Distribution list + run. Run posts (DR Founder_i / CR Business source)
 * for each partner share atomically inside one ledger transaction-group,
 * then records the Distribution + DistributionShare rows. 400 on any
 * refusal: net <= 0, no eligible partners, source not BUSINESS, source
 * overdraw.
 */

export async function GET(): Promise<Response> {
  const distributions = await new DistributionService().listAll();
  return jsonResponse({ distributions });
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

  const result = await new DistributionService().runQuarter(body, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ distribution: result.value }, { status: 201 });
}
