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
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { formatMoney, money, moneyFromMajor } from "@/lib/money";

interface AdjustBalanceButtonProps {
  accountId: string;
  accountName: string;
  /** Current balance in minor units, as a string (BigInt-safe over RSC). */
  currentBalanceMinor: string;
}

interface ApiError {
  error?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Account-scoped balance adjustment, shown on the account detail page (the
 * standalone Adjustments tab was folded into Accounts). Posts the difference
 * between the entered new balance and the current one through the ledger
 * against the Adjustments system account.
 */
export function AdjustBalanceButton({
  accountId,
  accountName,
  currentBalanceMinor,
}: AdjustBalanceButtonProps) {
  const router = useRouter();
  const currentMinor = BigInt(currentBalanceMinor);
  const currentDisplay = formatMoney(money(currentMinor));

  const [open, setOpen] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIso);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setNewBalanceInput("");
    setReason("");
    setEffectiveDate(todayIso());
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReason = reason.trim();
    const trimmedNew = newBalanceInput.trim();
    if (!trimmedNew || !trimmedReason) return;

    let minor: bigint;
    try {
      minor = moneyFromMajor(trimmedNew);
    } catch {
      toast.error("Enter a valid balance like 1234.56 or -1234.56");
      return;
    }
    if (minor === currentMinor) {
      toast.error(
        `New balance equals the current balance (${currentDisplay}); no adjustment needed`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/adjustments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId,
          newBalance: minor.toString(),
          reason: trimmedReason,
          effectiveDate,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to record adjustment");
        return;
      }
      toast.success(`Balance adjusted for "${accountName}"`);
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
    submitting || !newBalanceInput.trim() || !reason.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Adjust balance
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>
              {accountName} — current balance {currentDisplay}. The difference
              posts through the ledger against the Adjustments account; the
              reason is recorded permanently.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="adjust-new-balance">New balance</Label>
                <NumberInput
                  id="adjust-new-balance"
                  value={newBalanceInput}
                  onValueChange={setNewBalanceInput}
                  allowNegative
                  placeholder="1234.56"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adjust-date">Effective date</Label>
                <Input
                  id="adjust-date"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adjust-reason">Reason</Label>
              <Input
                id="adjust-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Bank fee reconciliation for May"
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
            <Button type="submit" disabled={submitDisabled}>
              {submitting ? "Recording…" : "Record adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
