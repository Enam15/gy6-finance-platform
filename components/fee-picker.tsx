"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  computeFeeMinor,
  percentToBps,
  type FeeMethodName,
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
 * Optional "transaction fee" control for the income/expense/transfer dialogs.
 * Captures method + a writeable name + a percentage, and previews the cut and
 * the resulting net/total live.
 */
export function FeePicker({
  idPrefix,
  value,
  onChange,
  totalMinor,
  direction,
  disabled,
}: FeePickerProps) {
  const bps = percentToBps(value.percent);
  const fee =
    totalMinor !== null && bps !== null
      ? computeFeeMinor(totalMinor, bps)
      : null;
  const net =
    totalMinor !== null && fee !== null
      ? direction === "in"
        ? totalMinor - fee
        : totalMinor + fee
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
              <Label htmlFor={`${idPrefix}-fee-percent`}>Percentage cut</Label>
              <Input
                id={`${idPrefix}-fee-percent`}
                value={value.percent}
                onChange={(e) => onChange({ ...value, percent: e.target.value })}
                placeholder="e.g. 10"
                inputMode="decimal"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-fee-label`}>
              Name (bank / wallet / Upwork account)
            </Label>
            <Input
              id={`${idPrefix}-fee-label`}
              value={value.label}
              onChange={(e) => onChange({ ...value, label: e.target.value })}
              placeholder="e.g. Meezan Bank, JazzCash, Upwork — Tashfeen"
              disabled={disabled}
            />
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
            {fee !== null ? (
              <div className="flex items-center justify-between tabular-nums">
                <span className="text-muted-foreground">Fee cut</span>
                <span className="font-medium">{formatMoney(money(fee))}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                Enter an amount and percentage to see the cut.
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
