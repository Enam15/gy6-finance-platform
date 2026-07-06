"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { cn } from "@/lib/utils";
import { formatMoney, money } from "@/lib/money";

interface QuarterOption {
  /** ISO date string (YYYY-MM-DD) for the quarter start. */
  value: string;
  /** Display label, e.g. "Q1 2026". */
  label: string;
}

interface RunDistributionDialogProps {
  quarterOptions: QuarterOption[];
  /** ISO date string of the default-selected quarter (most recent completed). */
  defaultQuarterStart: string;
}

interface PreviewShare {
  partnerId: string;
  partnerName: string;
  ratio: number;
  ratioDenominator: number;
  amount: string;
}

interface Preview {
  quarterStart: string;
  quarterEndExclusive: string;
  income: string;
  expense: string;
  netAmount: string;
  shares: PreviewShare[];
}

interface PreviewResponse {
  preview: Preview;
}

interface ApiError {
  error?: string;
}

function isPreview(data: unknown): data is PreviewResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "preview" in data &&
    typeof (data as { preview?: unknown }).preview === "object"
  );
}

export function RunDistributionDialog({
  quarterOptions,
  defaultQuarterStart,
}: RunDistributionDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [quarterStart, setQuarterStart] = useState(defaultQuarterStart);
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Refresh preview when dialog opens or quarter changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadPreview() {
      setLoadingPreview(true);
      setPreview(null);
      try {
        const res = await fetch("/api/distributions/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ quarterStart }),
        });
        const data: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          toast.error((data as ApiError).error ?? "Preview failed");
          return;
        }
        if (isPreview(data)) {
          setPreview(data.preview);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Network error");
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [open, quarterStart]);

  function reset() {
    setQuarterStart(defaultQuarterStart);
    setDescription("");
    setPreview(null);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || preview.shares.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/distributions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quarterStart,
          description: description.trim() ? description.trim() : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to run distribution");
        return;
      }
      toast.success("Distribution recorded");
      reset();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const canRun = !!preview && preview.shares.length > 0;

  const netBigInt = preview ? BigInt(preview.netAmount) : 0n;
  const netToneClass =
    netBigInt > 0n
      ? "text-green-700 dark:text-green-400"
      : netBigInt < 0n
        ? "text-red-700 dark:text-red-400"
        : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button>New distribution</Button>} />
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Distribute net profit</DialogTitle>
            <DialogDescription>
              Splits the quarter&apos;s net profit across partners by their
              share. The founder drawings post to the ledger automatically
              from your Business account.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="dist-quarter">Quarter</Label>
              <Select
                value={quarterStart}
                onValueChange={(v) => setQuarterStart(v ?? "")}
              >
                <SelectTrigger id="dist-quarter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarterOptions.map((q) => (
                    <SelectItem key={q.value} value={q.value}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border bg-muted/30 p-4">
              {loadingPreview ? (
                <p className="text-sm text-muted-foreground">
                  Loading preview...
                </p>
              ) : preview ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Income</p>
                      <p className="tabular-nums">
                        {formatMoney(money(BigInt(preview.income)))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expense</p>
                      <p className="tabular-nums">
                        {formatMoney(money(BigInt(preview.expense)))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net profit</p>
                      <p
                        className={cn(
                          "tabular-nums font-medium",
                          netToneClass,
                        )}
                      >
                        {formatMoney(money(netBigInt))}
                      </p>
                    </div>
                  </div>

                  {preview.shares.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Each partner gets
                      </p>
                      <div className="space-y-1">
                        {preview.shares.map((s) => (
                          <div
                            key={s.partnerId}
                            className="flex items-center justify-between text-sm tabular-nums"
                          >
                            <span>
                              {s.partnerName}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({s.ratio}/{s.ratioDenominator})
                              </span>
                            </span>
                            <span>{formatMoney(money(BigInt(s.amount)))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nothing to distribute for this quarter.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pick a quarter to see the split.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dist-description">Description (optional)</Label>
              <Input
                id="dist-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Q1 2026 profit distribution"
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
            <Button type="submit" disabled={submitting || !canRun}>
              {submitting ? "Running..." : "Run distribution"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
