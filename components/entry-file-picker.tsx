"use client";

import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { FileText, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_BYTES = 4 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface EntryFilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Collects files (drag & drop or browse) to attach to an entry as it's
 * created. It only stages the File objects; the dialog uploads them with
 * `uploadEntryFiles` once the entry exists and has an id.
 */
export function EntryFilePicker({
  files,
  onChange,
  disabled,
}: EntryFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function addFiles(incoming: FileList | File[]) {
    const valid: File[] = [];
    for (const f of Array.from(incoming)) {
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" is over 4 MB and was skipped`);
        continue;
      }
      if (f.size === 0) {
        toast.error(`"${f.name}" is empty and was skipped`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length > 0) onChange([...files, ...valid]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (disabled) return;
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  }

  return (
    <div className="grid gap-2">
      <Label>Attachments (optional)</Label>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-4 text-center text-sm outline-none transition-colors focus-visible:border-ring",
          dragActive
            ? "border-primary bg-accent"
            : "border-input hover:bg-muted/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <UploadCloud className="size-5 text-muted-foreground" />
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
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(f.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${f.name}`}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Upload staged files to an entry's attachments endpoint. Returns how many
 * succeeded; toasts per-file failures. `kind` is the URL segment ("income"
 * or the plural "expenses").
 */
export async function uploadEntryFiles(
  kind: "income" | "expenses",
  entryId: string,
  files: File[],
): Promise<number> {
  let uploaded = 0;
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/${kind}/${entryId}/attachments`, {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      uploaded += 1;
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(`Couldn't upload "${file.name}": ${data.error ?? "error"}`);
    }
  }
  return uploaded;
}
