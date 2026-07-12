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
import { RecurrencePicker } from "@/components/recurrence-picker";
import {
  DEFAULT_RECURRENCE,
  daysBetweenIso,
  nextOccurrenceIso,
  resolveInterval,
  type RecurrenceState,
} from "@/lib/recurrence";
import { EntryFormFields } from "@/components/entry-form-fields";
import {
  EntryFilePicker,
  uploadEntryFiles,
} from "@/components/entry-file-picker";
import { blankEntryForm, type EntryFormState } from "@/lib/entry-form";
import { feePayload } from "@/lib/fees";

export interface AccountOption {
  id: string;
  name: string;
}
export interface CategoryOption {
  id: string;
  name: string;
}

interface CreateIncomeDialogProps {
  accounts: AccountOption[];
  categories: CategoryOption[];
}

interface ApiError {
  error?: string;
}

export function CreateIncomeDialog({
  accounts,
  categories,
}: CreateIncomeDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EntryFormState>(blankEntryForm);
  const [recurrence, setRecurrence] =
    useState<RecurrenceState>(DEFAULT_RECURRENCE);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setForm(blankEntryForm());
    setRecurrence(DEFAULT_RECURRENCE);
    setFiles([]);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = form.description.trim();
    const trimmedAmount = form.amount.trim();
    if (
      !form.accountId ||
      !form.categoryId ||
      !trimmedDescription ||
      !trimmedAmount
    ) {
      return;
    }

    let minor: bigint;
    try {
      minor = moneyFromMajor(trimmedAmount);
    } catch {
      toast.error("Enter a valid amount like 1234.56");
      return;
    }
    if (minor <= 0n) {
      toast.error("Amount must be greater than zero");
      return;
    }

    const feeFields = feePayload(form.fee) ?? {};
    if (form.fee.enabled && !feePayload(form.fee)) {
      toast.error(
        form.fee.mode === "PERCENT"
          ? "Enter a valid fee percentage between 0 and 100"
          : "Enter a valid fee amount",
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientAccountId: form.accountId,
          categoryId: form.categoryId,
          description: trimmedDescription,
          totalAmount: minor.toString(),
          entryDate: form.entryDate,
          paymentDueOn: form.paymentDueOn,
          notes: form.notes.trim() ? form.notes.trim() : undefined,
          ...feeFields,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError & {
        entry?: { id?: string };
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create income draft");
        return;
      }

      const newId = data.entry?.id;
      if (newId && files.length > 0) {
        await uploadEntryFiles("income", newId, files);
      }

      const interval = resolveInterval(recurrence);
      if (interval) {
        const renewalRes = await fetch("/api/renewals", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "INCOME",
            name: trimmedDescription.slice(0, 120),
            accountId: form.accountId,
            categoryId: form.categoryId,
            description: trimmedDescription,
            totalAmount: minor.toString(),
            paymentTermsDays: daysBetweenIso(form.entryDate, form.paymentDueOn),
            intervalCount: interval.intervalCount,
            intervalUnit: interval.intervalUnit,
            firstRunOn: nextOccurrenceIso(form.entryDate, interval),
          }),
        });
        if (renewalRes.ok) {
          toast.success(
            `Income draft "${trimmedDescription}" created and set to repeat`,
          );
        } else {
          const rdata = (await renewalRes.json().catch(() => ({}))) as ApiError;
          toast.warning(
            `Income draft created, but the recurrence wasn't set up: ${rdata.error ?? "add it later"}`,
          );
        }
      } else {
        toast.success(`Income draft "${trimmedDescription}" created`);
      }

      reset();
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
    !form.accountId ||
    !form.categoryId ||
    !form.description.trim() ||
    !form.amount.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button>New income</Button>} />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Draft an income entry</DialogTitle>
            <DialogDescription>
              Drafts do not touch the ledger until you confirm them.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <EntryFormFields
              kind="income"
              idPrefix="income"
              value={form}
              onChange={setForm}
              accounts={accounts}
              categories={categories}
              submitting={submitting}
            />
            <RecurrencePicker
              idPrefix="income"
              value={recurrence}
              onChange={setRecurrence}
              disabled={submitting}
            />
            <EntryFilePicker
              files={files}
              onChange={setFiles}
              disabled={submitting}
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
              {submitting ? "Creating..." : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
