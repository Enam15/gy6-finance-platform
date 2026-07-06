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
import { Plus, X } from "lucide-react";

interface ApiError {
  error?: string;
}

type Kind = "DEBIT" | "CREDIT";

/**
 * Create a custom account category. The user picks whether its accounts hold
 * "money you have" (debit-normal) or "money you owe" (credit-normal), and can
 * attach any number of custom fields that then appear on accounts in it.
 */
export function CreateAccountCategoryDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("DEBIT");
  const [fields, setFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setKind("DEBIT");
    setFields([]);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const cleanFields = fields
      .map((label) => label.trim())
      .filter((label) => label.length > 0)
      .map((label) => ({ label }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/account-categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          normalBalance: kind,
          fields: cleanFields,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create category");
        return;
      }
      toast.success(`Category "${trimmed}" created`);
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
          <Button variant="outline">New category</Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create an account category</DialogTitle>
            <DialogDescription>
              Your own category, plus any custom fields you want on its
              accounts.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Savings, Investments, Loans"
                autoFocus
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cat-kind">These accounts hold</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind((v as Kind) ?? "DEBIT")}
              >
                <SelectTrigger id="cat-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBIT">
                    Money you have (cash, receivables)
                  </SelectItem>
                  <SelectItem value="CREDIT">
                    Money you owe (payables, loans)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sets how balances move on the ledger. Pick &ldquo;money you
                have&rdquo; for asset-like accounts.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Custom fields (optional)</Label>
              <div className="grid gap-2">
                {fields.map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={label}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((v, j) => (j === i ? e.target.value : v)),
                        )
                      }
                      placeholder="e.g. Account number, Contact, IBAN"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove field"
                      onClick={() =>
                        setFields((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => setFields((prev) => [...prev, ""])}
                >
                  <Plus className="size-4" /> Add field
                </Button>
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
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating..." : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
