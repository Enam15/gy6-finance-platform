import { TransferService } from "@/services/transfer-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Transfers between two Business accounts. Created in CONFIRMED state and
 * posted atomically via TransferService.createTransfer: DR `to`, CR `from`.
 * Source and destination must differ, both must be in the BUSINESS
 * category, and the source must have enough balance (the posting engine's
 * negative-balance guard kicks in unless allowNegative is set on it).
 */

export async function GET(): Promise<Response> {
  const transfers = await new TransferService().listAll();
  return jsonResponse({ transfers });
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

  const result = await new TransferService().createTransfer(body, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ transfer: result.value }, { status: 201 });
}
