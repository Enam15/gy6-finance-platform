"use client";

import { useState } from "react";
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
import { formatMoney, money } from "@/lib/money";

export interface BusinessAccountOption {
  id: string;
  name: string;
}

interface FullyPaidButtonProps {
  /** Which entry type - drives the endpoint and the copy. */
  kind: "income" | "expenses";
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
 * One-action settlement for a confirmed income/expense row. Records a payment
 * for the FULL outstanding amount (no partial payments - this is a recording
 * tool, so an entry is either outstanding or fully paid). Posts to
 * POST /api/{kind}/[id]/payments and refreshes.
 */
export function FullyPaidButton({
  kind,
  entryId,
  description,
  amountDueMinor,
  businessAccounts,
}: FullyPaidButtonProps) {
  const router = useRouter();
  const amountDue = BigInt(amountDueMinor);
  const amountDueDisplay = formatMoney(money(amountDue));
  const isIncome = kind === "income";
  const soleAccountId =
    businessAccounts.length === 1 ? (businessAccounts[0]?.id ?? "") : "";
  const accountItems = Object.fromEntries(
    businessAccounts.map((a) => [a.id, a.name]),
  );

  const [open, setOpen] = useState(false);
  const [businessAccountId, setBusinessAccountId] = useState(soleAccountId);
  const [paidOn, setPaidOn] = useState(todayIso);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setBusinessAccountId(soleAccountId);
    setPaidOn(todayIso());
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onConfirm() {
    if (!businessAccountId) {
      toast.error("Pick a business account");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/${kind}/${entryId}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessAccountId,
          amount: amountDue.toString(),
          paidOn,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to mark as paid");
        return;
      }
      toast.success(`"${description}" marked fully paid (${amountDueDisplay})`);
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
          <Button size="sm" variant="outline">
            Mark fully paid
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark fully paid</DialogTitle>
          <DialogDescription>
            {description} — moves the full outstanding {amountDueDisplay}{" "}
            {isIncome ? "into" : "out of"} a business account.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor={`fp-${entryId}-account`}>
              {isIncome ? "Bank account to receive it" : "Bank account to pay from"}
            </Label>
            {businessAccounts.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                You have no bank accounts yet. Add one under Accounts (the
                Business category) and it will show up here.
              </p>
            ) : (
              <Select
                items={accountItems}
                value={businessAccountId}
                onValueChange={(v) => setBusinessAccountId(v ?? "")}
              >
                <SelectTrigger id={`fp-${entryId}-account`}>
                  <SelectValue placeholder="Pick a bank account" />
                </SelectTrigger>
                <SelectContent>
                  {businessAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`fp-${entryId}-date`}>Paid on</Label>
            <Input
              id={`fp-${entryId}-date`}
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
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
            type="button"
            onClick={onConfirm}
            disabled={submitting || !businessAccountId}
          >
            {submitting ? "Saving…" : "Mark fully paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
