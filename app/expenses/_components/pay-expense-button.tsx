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
import {
  formatMoney,
  formatMoneyForInput,
  money,
  moneyFromMajor,
} from "@/lib/money";

export interface BusinessAccountOption {
  id: string;
  name: string;
}

interface PayExpenseButtonProps {
  entryId: string;
  description: string;
  /** Outstanding amount in minor units, as a string (BigInt-safe over RSC). */
  amountDueMinor: string;
  businessAccounts: BusinessAccountOption[];
}

interface ApiError {
  error?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Inline "Pay" action on a confirmed expense row. Opens a dialog with the
 * Business-account picker (the cash source), amount input pre-filled to
 * the outstanding total, paid-on date, and an optional note. Submits to
 * POST /api/expenses/[id]/payments and refreshes the page.
 */
export function PayExpenseButton({
  entryId,
  description,
  amountDueMinor,
  businessAccounts,
}: PayExpenseButtonProps) {
  const router = useRouter();
  const amountDue = BigInt(amountDueMinor);
  const amountDueDisplay = formatMoney(money(amountDue));

  const [open, setOpen] = useState(false);
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [amount, setAmount] = useState(() =>
    formatMoneyForInput(money(amountDue)),
  );
  const [paidOn, setPaidOn] = useState(todayIso);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setBusinessAccountId("");
    setAmount(formatMoneyForInput(money(amountDue)));
    setPaidOn(todayIso());
    setNote("");
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAmount = amount.trim();
    if (!businessAccountId || !trimmedAmount) return;

    let minor: bigint;
    try {
      minor = moneyFromMajor(trimmedAmount);
    } catch {
      toast.error("Enter a valid amount like 1234.56");
      return;
    }
    if (minor <= 0n) {
      toast.error("Payment must be greater than zero");
      return;
    }
    if (minor > amountDue) {
      toast.error(
        `Payment cannot exceed the outstanding amount (${amountDueDisplay})`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/expenses/${entryId}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessAccountId,
          amount: minor.toString(),
          paidOn,
          description: note.trim() ? note.trim() : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to record payment");
        return;
      }
      toast.success(
        `Payment of ${formatMoney(money(minor))} recorded for "${description}"`,
      );
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
    submitting || !businessAccountId || !amount.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            Pay
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Record payment made</DialogTitle>
            <DialogDescription>
              {description} - outstanding {amountDueDisplay}. Posts DR payee
              account, CR business account.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pay-expense-account">Business account</Label>
              <Select
                value={businessAccountId}
                onValueChange={(v) => setBusinessAccountId(v ?? "")}
              >
                <SelectTrigger id="pay-expense-account">
                  <SelectValue placeholder="Pick a Business account" />
                </SelectTrigger>
                <SelectContent>
                  {businessAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pay-expense-amount">Amount</Label>
                <Input
                  id="pay-expense-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1234.56"
                  inputMode="decimal"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-expense-date">Paid on</Label>
                <Input
                  id="pay-expense-date"
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pay-expense-note">Note (optional)</Label>
              <Input
                id="pay-expense-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. paid via bank transfer"
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
            <Button type="submit" disabled={submitDisabled}>
              {submitting ? "Recording..." : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
