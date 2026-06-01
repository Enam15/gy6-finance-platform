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

export interface AccountOption {
  id: string;
  name: string;
}
export interface CategoryOption {
  id: string;
  name: string;
}

interface CreateExpenseDialogProps {
  accounts: AccountOption[];
  categories: CategoryOption[];
}

interface ApiError {
  error?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateExpenseDialog({
  accounts,
  categories,
}: CreateExpenseDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [payeeAccountId, setPayeeAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso);
  const [paymentDueOn, setPaymentDueOn] = useState(todayIso);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setPayeeAccountId("");
    setCategoryId("");
    setDescription("");
    setAmount("");
    setEntryDate(todayIso());
    setPaymentDueOn(todayIso());
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
      !payeeAccountId ||
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
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payeeAccountId,
          categoryId,
          description: trimmedDescription,
          totalAmount: minor.toString(),
          entryDate,
          paymentDueOn,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create expense draft");
        return;
      }
      toast.success(`Expense draft "${trimmedDescription}" created`);
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
    !payeeAccountId ||
    !categoryId ||
    !description.trim() ||
    !amount.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button>New expense</Button>} />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Draft an expense entry</DialogTitle>
            <DialogDescription>
              Drafts do not touch the ledger until you confirm them.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="expense-account">Payee account</Label>
                <Select
                  value={payeeAccountId}
                  onValueChange={(v) => setPayeeAccountId(v ?? "")}
                >
                  <SelectTrigger id="expense-account">
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
                <Label htmlFor="expense-category">Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => setCategoryId(v ?? "")}
                >
                  <SelectTrigger id="expense-category">
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
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. June salary - Mustafa"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="expense-amount">Amount</Label>
                <Input
                  id="expense-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1234.56"
                  inputMode="decimal"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-entry-date">Entry date</Label>
                <Input
                  id="expense-entry-date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-due-date">Payment due</Label>
                <Input
                  id="expense-due-date"
                  type="date"
                  value={paymentDueOn}
                  onChange={(e) => setPaymentDueOn(e.target.value)}
                  required
                />
              </div>
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
              {submitting ? "Creating..." : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
