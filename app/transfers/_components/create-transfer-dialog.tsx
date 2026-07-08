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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moneyFromMajor } from "@/lib/money";
import { FeePicker } from "@/components/fee-picker";
import { DEFAULT_FEE, feePayload, type FeeState } from "@/lib/fees";

export interface BusinessAccountOption {
  id: string;
  name: string;
}

interface CreateTransferDialogProps {
  businessAccounts: BusinessAccountOption[];
}

interface ApiError {
  error?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parse the amount field to positive minor units, or null if not yet valid. */
function parseAmountMinor(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const m = moneyFromMajor(trimmed);
    return m > 0n ? m : null;
  } catch {
    return null;
  }
}

export function CreateTransferDialog({
  businessAccounts,
}: CreateTransferDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIso);
  const [description, setDescription] = useState("");
  const [fee, setFee] = useState<FeeState>(DEFAULT_FEE);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFromAccountId("");
    setToAccountId("");
    setAmount("");
    setEffectiveDate(todayIso());
    setDescription("");
    setFee(DEFAULT_FEE);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAmount = amount.trim();
    if (!fromAccountId || !toAccountId || !trimmedAmount) return;
    if (fromAccountId === toAccountId) {
      toast.error("Source and destination must be different accounts");
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

    const feeFields = feePayload(fee) ?? {};
    if (fee.enabled && !feePayload(fee)) {
      toast.error(
        fee.mode === "PERCENT"
          ? "Enter a valid fee percentage between 0 and 100"
          : "Enter a valid fee amount",
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: minor.toString(),
          effectiveDate,
          description: description.trim() ? description.trim() : undefined,
          ...feeFields,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to record transfer");
        return;
      }
      toast.success("Transfer recorded");
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
    !fromAccountId ||
    !toAccountId ||
    fromAccountId === toAccountId ||
    !amount.trim();

  // value -> label map so the trigger shows the account name, not its id.
  const accountItems = Object.fromEntries(
    businessAccounts.map((a) => [a.id, a.name]),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button>New transfer</Button>} />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Record a transfer</DialogTitle>
            <DialogDescription>
              Move cash between two Business accounts. Posts DR destination,
              CR source.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="transfer-from">From</Label>
                <Select
                  items={accountItems}
                  value={fromAccountId}
                  onValueChange={(v) => setFromAccountId(v ?? "")}
                >
                  <SelectTrigger id="transfer-from">
                    <SelectValue placeholder="Source" />
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
              <div className="grid gap-2">
                <Label htmlFor="transfer-to">To</Label>
                <Select
                  items={accountItems}
                  value={toAccountId}
                  onValueChange={(v) => setToAccountId(v ?? "")}
                >
                  <SelectTrigger id="transfer-to">
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessAccounts
                      .filter((a) => a.id !== fromAccountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="transfer-amount">Amount</Label>
                <NumberInput
                  id="transfer-amount"
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="1234.56"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transfer-date">Effective date</Label>
                <Input
                  id="transfer-date"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transfer-description">Description (optional)</Label>
              <Input
                id="transfer-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Sweep to operating account"
              />
            </div>

            <FeePicker
              idPrefix="transfer"
              value={fee}
              onChange={setFee}
              totalMinor={parseAmountMinor(amount)}
              direction="in"
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
              {submitting ? "Recording..." : "Record transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
