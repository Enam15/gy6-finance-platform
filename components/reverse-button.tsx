"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReverseButtonProps {
  /** API path that handles the reversal POST, e.g. "/api/income/abc/reverse". */
  apiPath: string;
  /** Noun for dialog title + toast (e.g. "Income", "Transfer"). */
  what: string;
  /** Short description for the dialog body (typically the entry description). */
  description?: string;
}

interface ApiError {
  error?: string;
}

/**
 * Reusable "Reverse" action with a reason-required confirmation dialog.
 * POSTs to `apiPath` with `{ reason }` and refreshes the page on success.
 * The server enforces all the real rules (already reversed, payments
 * exist, etc.); the client just surfaces the error as a toast.
 */
export function ReverseButton({
  apiPath,
  what,
  description,
}: ReverseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setReason("");
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;

    setSubmitting(true);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: trimmedReason }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to reverse");
        return;
      }
      toast.success(`${what} reversed`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost">
            Reverse
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Reverse {what.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              {description ??
                "Posts a mirrored ledger entry to cancel the effect. The original posting is preserved."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reverse-reason">Reason</Label>
              <Input
                id="reverse-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Posted in error - duplicate entry"
                autoFocus
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={submitting || !reason.trim()}
            >
              {submitting ? "Reversing..." : "Reverse"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
