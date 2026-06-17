import { z } from "zod";
import type { Note, PrismaClient } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { NoteRepository } from "@/repositories/note-repository";

const createSchema = z.object({
  body: z.string().trim().min(1, "A note can't be empty").max(5000),
});

interface ActorOptions {
  actorId?: string | null;
  actorLabel?: string | null;
}

/**
 * Shared-notes business logic. Notes are a free-form scratchpad, not
 * financial data - so unlike the ledger they can be created and deleted
 * freely. `createdBy` records who wrote each note (the session label).
 */
export class NoteService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listAll(): Promise<Note[]> {
    return new NoteRepository(this.db).listAll();
  }

  async create(
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<Note>> {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const note = await new NoteRepository(this.db).create({
      body: parsed.data.body,
      createdBy: options.actorLabel ?? null,
    });
    return ok(note);
  }

  async remove(id: string): Promise<Result<Note>> {
    try {
      const note = await new NoteRepository(this.db).delete(id);
      return ok(note);
    } catch {
      return err(`Note ${id} was not found`);
    }
  }
}
