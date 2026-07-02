import { AttachmentService } from "@/services/attachment-service";
import { IncomeService } from "@/services/income-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/** Attachments for an income entry: list + upload. */

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const attachments = await new AttachmentService().listForIncome(id);
  return jsonResponse({ attachments });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const actor = await getActor();

  const entry = await new IncomeService().getEntry(id);
  if (!entry.ok) return jsonResponse({ error: entry.error }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse(
      { error: "Expected a multipart form upload" },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse({ error: "No file provided" }, { status: 400 });
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const result = await new AttachmentService().create(
    { incomeEntryId: id, fileName: file.name, contentType: file.type, data },
    { actorId: actor?.id ?? null, actorLabel: actor?.label ?? null },
  );
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ attachment: result.value }, { status: 201 });
}
