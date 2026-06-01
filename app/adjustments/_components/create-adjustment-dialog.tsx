"use client";

import { useState, useMemo, type FormEvent } from "react";
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
import { formatMoney, money, moneyFromMajor } from "@/lib/money";

export interface AdjustmentAccountOption {
  id: string;
  name: string;
  /** Current balance in minor units, as a string (BigInt-safe over RSC). */
  balanceMinor: string;
}

interface CreateAdjustmentDialogProps {
  accounts: AdjustmentAccountOption[];
}

interface ApiError {
  error?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateAdjustmentDialog({
  accounts,
}: CreateAdjustmentDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [newBalanceInput, setNewBalanceInput] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIso);
  const [submitting, setSubmitting] = useState(false);

  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const selected = accountId ? accountById.get(accountId) : undefined;
  const currentBalanceMinor = selected ? BigInt(selected.balanceMinor) : 0n;
  const currentBalanceDisplay = selected
    ? formatMoney(money(currentBalanceMinor))
    : null;

  function reset() {
    setAccountId("");
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
    if (!accountId || !trimmedNew || !trimmedReason) return;

    let minor: bigint;
    try {
      minor = moneyFromMajor(trimmedNew);
    } catch {
      toast.error("Enter a valid balance like 1234.56 or -1234.56");
      return;
    }
    if (minor === currentBalanceMinor) {
      toast.error(
        `New balance equals the current balance (${currentBalanceDisplay}); no adjustment needed`,
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
      toast.success("Adjustment recorded");
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
    submitting || !accountId || !newBalanceInput.trim() || !reason.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button>New adjustment</Button>} />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust an account balance</DialogTitle>
            <DialogDescription>
              The difference is posted through the ledger against the
              Adjustments account. The reason is recorded permanently.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="adjust-account">Account</Label>
              <Select
                value={accountId}
                onValueChange={(v) => setAccountId(v ?? "")}
              >
                <SelectTrigger id="adjust-account">
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
              {currentBalanceDisplay && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Current balance: {currentBalanceDisplay}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="adjust-new-balance">New balance</Label>
                <Input
                  id="adjust-new-balance"
                  value={newBalanceInput}
                  onChange={(e) => setNewBalanceInput(e.target.value)}
                  placeholder="1234.56"
                  inputMode="decimal"
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
              {submitting ? "Recording..." : "Record adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
