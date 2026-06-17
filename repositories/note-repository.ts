import type { Note } from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

export interface CreateNoteData {
  body: string;
  createdBy?: string | null;
}

/** Data access for shared notes. No business logic. */
export class NoteRepository {
  constructor(private readonly db: DbClient) {}

  listAll(): Promise<Note[]> {
    return this.db.note.findMany({ orderBy: { createdAt: "desc" } });
  }

  create(data: CreateNoteData): Promise<Note> {
    return this.db.note.create({
      data: { body: data.body, createdBy: data.createdBy ?? null },
    });
  }

  delete(id: string): Promise<Note> {
    return this.db.note.delete({ where: { id } });
  }
}
