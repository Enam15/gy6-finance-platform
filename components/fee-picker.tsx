"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, money } from "@/lib/money";
import {
  FEE_METHOD_OPTIONS,
  feeCutMinor,
  type FeeMethodName,
  type FeeMode,
  type FeeState,
} from "@/lib/fees";

interface FeePickerProps {
  idPrefix: string;
  value: FeeState;
  onChange: (next: FeeState) => void;
  /** Parsed total in minor units, or null when the amount field is empty/invalid. */
  totalMinor: bigint | null;
  /** "in" = money received (net = total − fee); "out" = money paid (cost = total + fee). */
  direction: "in" | "out";
  disabled?: boolean;
}

/**
 * Optional "transaction fee" control. The fee can be a percentage of the
 * amount or a fixed amount; either way the cut and resulting net/total are
 * previewed live.
 */
export function FeePicker({
  idPrefix,
  value,
  onChange,
  totalMinor,
  direction,
  disabled,
}: FeePickerProps) {
  const cut = feeCutMinor(value, totalMinor);
  const net =
    totalMinor !== null && cut !== null
      ? direction === "in"
        ? totalMinor - cut
        : totalMinor + cut
      : null;
  const netLabel = direction === "in" ? "Net received" : "Total cost";

  return (
    <div className="grid gap-3 rounded-md border p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded border-input accent-[var(--primary)]"
        />
        This transaction had a fee
      </label>

      {value.enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-fee-method`}>Charged via</Label>
              <Select
                value={value.method}
                onValueChange={(v) =>
                  onChange({ ...value, method: (v as FeeMethodName) ?? "BANK" })
                }
                disabled={disabled}
              >
                <SelectTrigger id={`${idPrefix}-fee-method`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEE_METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-fee-mode`}>Fee type</Label>
              <Select
                value={value.mode}
                onValueChange={(v) =>
                  onChange({ ...value, mode: (v as FeeMode) ?? "PERCENT" })
                }
                disabled={disabled}
              >
                <SelectTrigger id={`${idPrefix}-fee-mode`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percentage</SelectItem>
                  <SelectItem value="FIXED">Fixed fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {value.mode === "PERCENT" ? (
              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-fee-percent`}>
                  Percentage cut
                </Label>
                <NumberInput
                  id={`${idPrefix}-fee-percent`}
                  value={value.percent}
                  onValueChange={(v) => onChange({ ...value, percent: v })}
                  placeholder="e.g. 10"
                  disabled={disabled}
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-fee-amount`}>Fee amount</Label>
                <NumberInput
                  id={`${idPrefix}-fee-amount`}
                  value={value.amount}
                  onValueChange={(v) => onChange({ ...value, amount: v })}
                  placeholder="e.g. 250"
                  disabled={disabled}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-fee-label`}>Name (optional)</Label>
              <Input
                id={`${idPrefix}-fee-label`}
                value={value.label}
                onChange={(e) => onChange({ ...value, label: e.target.value })}
                placeholder="e.g. Meezan, JazzCash, Upwork"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
            {cut !== null ? (
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-muted-foreground">Fee cut</span>
                <span className="font-medium">{formatMoney(money(cut))}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {value.mode === "PERCENT"
                  ? "Enter an amount and percentage to see the cut."
                  : "Enter the fee amount."}
              </span>
            )}
            {net !== null && (
              <div className="mt-1 flex items-center justify-between tabular-nums">
                <span className="text-muted-foreground">{netLabel}</span>
                <span className="font-medium">{formatMoney(money(net))}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
