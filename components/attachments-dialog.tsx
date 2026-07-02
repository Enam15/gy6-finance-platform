"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileText, Paperclip, Trash2, UploadCloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_BYTES = 4 * 1024 * 1024;

interface AttachmentItem {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface AttachmentsDialogProps {
  kind: "income" | "expenses";
  entryId: string;
  label: string;
  count: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsDialog({
  kind,
  entryId,
  label,
  count,
}: AttachmentsDialogProps) {
  const router = useRouter();
  const listUrl = `/api/${kind}/${entryId}/attachments`;

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(listUrl);
      const data = (await res.json().catch(() => ({}))) as {
        attachments?: AttachmentItem[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to load files");
        return;
      }
      setItems(data.attachments ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void refresh();
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of list) {
        if (file.size > MAX_BYTES) {
          toast.error(`"${file.name}" is over 4 MB and was skipped`);
          continue;
        }
        if (file.size === 0) {
          toast.error(`"${file.name}" is empty and was skipped`);
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(listUrl, { method: "POST", body: form });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(`Couldn't upload "${file.name}": ${data.error ?? "error"}`);
          continue;
        }
        uploaded += 1;
      }
      if (uploaded > 0) {
        toast.success(`${uploaded} file${uploaded === 1 ? "" : "s"} uploaded`);
        await refresh();
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files?.length) {
      void uploadFiles(event.dataTransfer.files);
    }
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Failed to delete file");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <Paperclip className="size-3.5" />
            Files{count > 0 ? ` (${count})` : ""}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attachments</DialogTitle>
          <DialogDescription>
            {label} — payslips, contracts, invoices, or any file.
          </DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm outline-none transition-colors focus-visible:border-ring",
            dragActive ? "border-primary bg-accent" : "border-input hover:bg-muted/50",
          )}
        >
          <UploadCloud className="size-6 text-muted-foreground" />
          <div>
            <span className="font-medium text-foreground">Drag &amp; drop</span>{" "}
            <span className="text-muted-foreground">
              or click to browse (any file, up to 4 MB each)
            </span>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {uploading && (
          <p className="text-xs text-muted-foreground">Uploading…</p>
        )}

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No files yet.
            </p>
          ) : (
            items.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 rounded-lg border p-2.5"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(it.sizeBytes)}
                  </p>
                </div>
                <a
                  href={`/api/attachments/${it.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${it.fileName}`}
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <Download className="size-4" />
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(it.id)}
                  disabled={deletingId === it.id}
                  aria-label={`Delete ${it.fileName}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
