import { NoteService } from "@/services/note-service";
import { jsonResponse } from "@/lib/json";

/** Delete a shared note. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const result = await new NoteService().remove(id);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 404 });
  }
  return jsonResponse({ ok: true });
}
