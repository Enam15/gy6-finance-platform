import { DistributionService } from "@/services/distribution-service";
import { jsonResponse } from "@/lib/json";

/**
 * Preview the distribution for a quarter. Pure read - no writes, no side
 * effects. Body: { quarterStart: ISO date }. Response includes net,
 * income, expense and per-partner shares (empty when net <= 0).
 *
 * The service normalises the input to the actual start of the calendar
 * quarter containing the input date, so the client can send any date
 * within the quarter.
 */
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

  const result = await new DistributionService().computeQuarter(body);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ preview: result.value });
}
