import { NoteService } from "@/services/note-service";
import { getActor } from "@/lib/auth";
import { jsonResponse } from "@/lib/json";

/** Shared notes: list + create. */

export async function GET(): Promise<Response> {
  const notes = await new NoteService().listAll();
  return jsonResponse({ notes });
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

  const result = await new NoteService().create(body, {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }
  return jsonResponse({ note: result.value }, { status: 201 });
}
