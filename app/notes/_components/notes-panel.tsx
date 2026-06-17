"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface NoteItem {
  id: string;
  body: string;
  createdBy: string | null;
  createdAt: string;
}

interface ApiError {
  error?: string;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function NotesPanel({ notes }: { notes: NoteItem[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add note");
        return;
      }
      setBody("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to remove note");
        return;
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onAdd} className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note... e.g. follow up with Acme on the May invoice"
          rows={3}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
            {submitting ? "Adding..." : "Add note"}
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          No notes yet. Add the first one above.
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border p-3">
              <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {note.createdBy ?? "Someone"} · {formatWhen(note.createdAt)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(note.id)}
                  disabled={deletingId === note.id}
                >
                  {deletingId === note.id ? "Removing..." : "Remove"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
