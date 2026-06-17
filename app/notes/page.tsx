import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NoteService } from "@/services/note-service";
import { NotesPanel } from "./_components/notes-panel";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const notes = await new NoteService().listAll();
  const items = notes.map((n) => ({
    id: n.id,
    body: n.body,
    createdBy: n.createdBy,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="text-sm text-muted-foreground">
          A shared scratchpad for Tashfeen and Itmam - reminders and anything
          worth keeping an eye on.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shared notes ({items.length})</CardTitle>
          <CardDescription>
            Newest first. Anyone signed in can add or remove notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotesPanel notes={items} />
        </CardContent>
      </Card>
    </div>
  );
}
