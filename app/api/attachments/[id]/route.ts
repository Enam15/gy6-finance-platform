import { AttachmentService } from "@/services/attachment-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/**
 * Download or delete an attachment. This route is behind the auth proxy, so
 * the sensitive file bytes are never served to an unauthenticated request.
 * Only a safe allowlist is shown inline; everything else is forced to
 * download, with nosniff, to avoid rendering hostile uploads on our origin.
 */
const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const attachment = await new AttachmentService().findForDownload(id);
  if (!attachment) {
    return jsonResponse({ error: "Attachment not found" }, { status: 404 });
  }

  const disposition = INLINE_TYPES.has(attachment.contentType)
    ? "inline"
    : "attachment";
  const safeName = attachment.fileName.replace(/["\r\n]/g, "");

  return new Response(new Uint8Array(attachment.data), {
    status: 200,
    headers: {
      "Content-Type": attachment.contentType || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Content-Length": String(attachment.sizeBytes),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const actor = await getActor();
  const result = await new AttachmentService().remove(id, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 404 });
  }
  return jsonResponse({ ok: true });
}
