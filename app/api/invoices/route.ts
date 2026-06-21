import { InvoiceService } from "@/services/invoice-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/** Invoices: list + create. */

export async function GET(): Promise<Response> {
  const invoices = await new InvoiceService().listInvoices();
  return jsonResponse({ invoices });
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

  const result = await new InvoiceService().create(body, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ invoice: { id: result.value.id } }, { status: 201 });
}
