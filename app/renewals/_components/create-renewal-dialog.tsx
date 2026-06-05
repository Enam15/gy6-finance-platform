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

interface CreateRenewalDialogProps {
  accounts: AccountOption[];
  incomeCategories: CategoryOption[];
  expenseCategories: CategoryOption[];
}

type Kind = "INCOME" | "EXPENSE";
type Unit = "DAY" | "WEEK" | "MONTH" | "YEAR";

interface ApiError {
  error?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateRenewalDialog({
  accounts,
  incomeCategories,
  expenseCategories,
}: CreateRenewalDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("INCOME");
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("0");
  const [intervalCount, setIntervalCount] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState<Unit>("MONTH");
  const [firstRunOn, setFirstRunOn] = useState(todayIso);
  const [endOn, setEndOn] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const categories = kind === "INCOME" ? incomeCategories : expenseCategories;

  function reset() {
    setKind("INCOME");
    setName("");
    setAccountId("");
    setCategoryId("");
    setDescription("");
    setAmount("");
    setPaymentTermsDays("0");
    setIntervalCount("1");
    setIntervalUnit("MONTH");
    setFirstRunOn(todayIso());
    setEndOn("");
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function onKindChange(value: string | null) {
    setKind((value ?? "INCOME") as Kind);
    // The category list changes with the kind; clear the stale selection.
    setCategoryId("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedAmount = amount.trim();
    const count = Number(intervalCount);

    if (
      !trimmedName ||
      !accountId ||
      !categoryId ||
      !trimmedDescription ||
      !trimmedAmount ||
      !Number.isInteger(count) ||
      count < 1
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
      const res = await fetch("/api/renewals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          name: trimmedName,
          accountId,
          categoryId,
          description: trimmedDescription,
          totalAmount: minor.toString(),
          paymentTermsDays: paymentTermsDays.trim() || "0",
          intervalCount,
          intervalUnit,
          firstRunOn,
          endOn: endOn.trim() ? endOn : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create renewal template");
        return;
      }
      toast.success(`Renewal template "${trimmedName}" created`);
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
    !name.trim() ||
    !accountId ||
    !categoryId ||
    !description.trim() ||
    !amount.trim() ||
    Number(intervalCount) < 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button>New template</Button>} />
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create a renewal template</DialogTitle>
            <DialogDescription>
              Defines a recurring income or expense. Generating it later
              creates DRAFT entries you review and confirm - it never posts
              automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="renewal-kind">Kind</Label>
                <Select value={kind} onValueChange={onKindChange}>
                  <SelectTrigger id="renewal-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="renewal-name">Template name</Label>
                <Input
                  id="renewal-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme monthly retainer"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="renewal-account">
                  {kind === "INCOME" ? "Client account" : "Payee account"}
                </Label>
                <Select
                  value={accountId}
                  onValueChange={(v) => setAccountId(v ?? "")}
                >
                  <SelectTrigger id="renewal-account">
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
                <Label htmlFor="renewal-category">Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => setCategoryId(v ?? "")}
                >
                  <SelectTrigger id="renewal-category">
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
              <Label htmlFor="renewal-description">Description</Label>
              <Input
                id="renewal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Copied onto each generated entry"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="renewal-amount">Amount</Label>
                <Input
                  id="renewal-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1234.56"
                  inputMode="decimal"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="renewal-interval-count">Every</Label>
                <Input
                  id="renewal-interval-count"
                  value={intervalCount}
                  onChange={(e) => setIntervalCount(e.target.value)}
                  inputMode="numeric"
                  placeholder="1"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="renewal-interval-unit">Unit</Label>
                <Select
                  value={intervalUnit}
                  onValueChange={(v) => setIntervalUnit((v ?? "MONTH") as Unit)}
                >
                  <SelectTrigger id="renewal-interval-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAY">Day(s)</SelectItem>
                    <SelectItem value="WEEK">Week(s)</SelectItem>
                    <SelectItem value="MONTH">Month(s)</SelectItem>
                    <SelectItem value="YEAR">Year(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="renewal-terms">Payment terms (days)</Label>
                <Input
                  id="renewal-terms"
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="renewal-first-run">First run on</Label>
                <Input
                  id="renewal-first-run"
                  type="date"
                  value={firstRunOn}
                  onChange={(e) => setFirstRunOn(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="renewal-end">End on (optional)</Label>
                <Input
                  id="renewal-end"
                  type="date"
                  value={endOn}
                  onChange={(e) => setEndOn(e.target.value)}
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
              {submitting ? "Creating..." : "Create template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
