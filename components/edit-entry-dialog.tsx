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
import { moneyFromMajor } from "@/lib/money";
import { EntryFormFields, type EntryOption } from "@/components/entry-form-fields";
import {
  entryToForm,
  type EntryFormState,
  type SerializedEntry,
} from "@/lib/entry-form";
import { feePayload } from "@/lib/fees";
import { POSTED_LOCK_REASON, lockedFieldsFor } from "@/lib/entry-edit";

interface EditEntryDialogProps {
  kind: "income" | "expense";
  entry: SerializedEntry;
  accounts: EntryOption[];
  categories: EntryOption[];
}

interface ApiError {
  error?: string;
}

/**
 * Edit an income/expense entry. A draft is fully editable. A posted entry
 * shows the same form with its ledger-backed fields locked, and sends only
 * the fields the server will accept - so a locked value can't even be
 * expressed, let alone saved.
 */
export function EditEntryDialog({
  kind,
  entry,
  accounts,
  categories,
}: EditEntryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EntryFormState>(() => entryToForm(entry));
  const [submitting, setSubmitting] = useState(false);

  const posted = entry.state === "CONFIRMED";
  const lockedFields = lockedFieldsFor(entry.state);

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Re-seed from the entry each time the dialog opens so a cancelled edit
    // doesn't leak into the next open.
    if (next) setForm(entryToForm(entry));
  }

  /**
   * The body for a posted entry carries only what the server will accept -
   * its schema is strict, so including a locked field would fail the request
   * rather than be ignored.
   */
  function postedPayload() {
    return {
      categoryId: form.categoryId,
      description: form.description.trim(),
      paymentDueOn: form.paymentDueOn,
      notes: form.notes.trim() ? form.notes.trim() : null,
    };
  }

  function draftPayload(): Record<string, unknown> | null {
    const trimmedAmount = form.amount.trim();
    let minor: bigint;
    try {
      minor = moneyFromMajor(trimmedAmount);
    } catch {
      toast.error("Enter a valid amount like 1234.56");
      return null;
    }
    if (minor <= 0n) {
      toast.error("Amount must be greater than zero");
      return null;
    }
    if (form.fee.enabled && !feePayload(form.fee)) {
      toast.error(
        form.fee.mode === "PERCENT"
          ? "Enter a valid fee percentage between 0 and 100"
          : "Enter a valid fee amount",
      );
      return null;
    }
    const accountKey = kind === "income" ? "clientAccountId" : "payeeAccountId";
    return {
      [accountKey]: form.accountId,
      entryDate: form.entryDate,
      totalAmount: minor.toString(),
      ...postedPayload(),
      ...(feePayload(form.fee) ?? {}),
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.categoryId || !form.description.trim()) return;
    if (!posted && (!form.accountId || !form.amount.trim())) return;

    const body = posted ? postedPayload() : draftPayload();
    if (!body) return;

    const path =
      kind === "income"
        ? `/api/income/${entry.id}`
        : `/api/expenses/${entry.id}`;

    setSubmitting(true);
    try {
      const res = await fetch(path, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save changes");
        return;
      }
      toast.success(posted ? "Entry updated" : "Draft updated");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled =
    submitting ||
    !form.categoryId ||
    !form.description.trim() ||
    (!posted && (!form.accountId || !form.amount.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Edit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              Edit {kind} {posted ? "entry" : "draft"}
            </DialogTitle>
            <DialogDescription>
              {posted
                ? POSTED_LOCK_REASON
                : "This entry hasn't posted to the ledger yet, so everything is still editable."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <EntryFormFields
              kind={kind}
              idPrefix={`edit-${kind}-${entry.id}`}
              value={form}
              onChange={setForm}
              accounts={accounts}
              categories={categories}
              submitting={submitting}
              lockedFields={lockedFields}
            />
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
            <Button type="submit" disabled={submitDisabled}>
              {submitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
