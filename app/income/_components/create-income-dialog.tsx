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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moneyFromMajor } from "@/lib/money";
import { RecurrencePicker } from "@/components/recurrence-picker";
import {
  DEFAULT_RECURRENCE,
  daysBetweenIso,
  nextOccurrenceIso,
  resolveInterval,
  type RecurrenceState,
} from "@/lib/recurrence";

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateIncomeDialog({
  accounts,
  categories,
}: CreateIncomeDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [clientAccountId, setClientAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso);
  const [paymentDueOn, setPaymentDueOn] = useState(todayIso);
  const [recurrence, setRecurrence] =
    useState<RecurrenceState>(DEFAULT_RECURRENCE);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setClientAccountId("");
    setCategoryId("");
    setDescription("");
    setAmount("");
    setEntryDate(todayIso());
    setPaymentDueOn(todayIso());
    setRecurrence(DEFAULT_RECURRENCE);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    const trimmedAmount = amount.trim();
    if (
      !clientAccountId ||
      !categoryId ||
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

    setSubmitting(true);
    try {
      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientAccountId,
          categoryId,
          description: trimmedDescription,
          totalAmount: minor.toString(),
          entryDate,
          paymentDueOn,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create income draft");
        return;
      }

      const interval = resolveInterval(recurrence);
      if (interval) {
        const renewalRes = await fetch("/api/renewals", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "INCOME",
            name: trimmedDescription.slice(0, 120),
            accountId: clientAccountId,
            categoryId,
            description: trimmedDescription,
            totalAmount: minor.toString(),
            paymentTermsDays: daysBetweenIso(entryDate, paymentDueOn),
            intervalCount: interval.intervalCount,
            intervalUnit: interval.intervalUnit,
            firstRunOn: nextOccurrenceIso(entryDate, interval),
          }),
        });
        if (renewalRes.ok) {
          toast.success(
            `Income draft "${trimmedDescription}" created and set to repeat`,
          );
        } else {
          const rdata = (await renewalRes.json().catch(() => ({}))) as ApiError;
          toast.warning(
            `Income draft created, but the recurrence wasn't set up: ${rdata.error ?? "add it on the Renewals page"}`,
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
    !clientAccountId ||
    !categoryId ||
    !description.trim() ||
    !amount.trim();

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
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="income-account">Source account</Label>
                <Select
                  value={clientAccountId}
                  onValueChange={(v) => setClientAccountId(v ?? "")}
                >
                  <SelectTrigger id="income-account">
                    <SelectValue placeholder="Pick an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="income-category">Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => setCategoryId(v ?? "")}
                >
                  <SelectTrigger id="income-category">
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="income-description">Description</Label>
              <Input
                id="income-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. May retainer for Acme Corp"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="income-amount">Amount</Label>
                <Input
                  id="income-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1234.56"
                  inputMode="decimal"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="income-entry-date">Entry date</Label>
                <Input
                  id="income-entry-date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="income-due-date">Payment due</Label>
                <Input
                  id="income-due-date"
                  type="date"
                  value={paymentDueOn}
                  onChange={(e) => setPaymentDueOn(e.target.value)}
                  required
                />
              </div>
            </div>

            <RecurrencePicker
              idPrefix="income"
              value={recurrence}
              onChange={setRecurrence}
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
