/**
 * Client-safe helpers for transaction fees.
 *
 * A fee is recorded as a real cost: at settlement the payment posting debits
 * a "Transaction Fees" system account for the cut, so the business's net
 * (cash received on income, total cost on an expense) stays correct. The
 * fee is stored on the entry as basis points + a snapshot amount, plus the
 * method and a free-text label naming the specific bank / wallet / Upwork
 * account it was charged through.
 */

import { moneyFromMajor } from "@/lib/money";

export type FeeMethodName = "BANK" | "UPWORK" | "ONLINE_WALLET";

export const FEE_METHOD_OPTIONS: { value: FeeMethodName; label: string }[] = [
  { value: "BANK", label: "Bank" },
  { value: "UPWORK", label: "Upwork" },
  { value: "ONLINE_WALLET", label: "Online wallet" },
];

export function feeMethodLabel(method: string): string {
  return (
    FEE_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method
  );
}

export type FeeMode = "PERCENT" | "FIXED";

export interface FeeState {
  enabled: boolean;
  method: FeeMethodName;
  label: string;
  mode: FeeMode;
  percent: string;
  amount: string; // major units, for FIXED mode
}

export const DEFAULT_FEE: FeeState = {
  enabled: false,
  method: "BANK",
  label: "",
  mode: "PERCENT",
  percent: "",
  amount: "",
};

/** Percent string -> basis points (1..10000), or null when empty/invalid. */
export function percentToBps(percent: string): number | null {
  const trimmed = percent.trim();
  if (trimmed === "") return null;
  const p = Number.parseFloat(trimmed);
  if (!Number.isFinite(p) || p < 0) return null;
  const bps = Math.round(p * 100);
  if (bps <= 0 || bps > 10000) return null;
  return bps;
}

/** Basis points -> human percent string (e.g. 1050 -> "10.5"). */
export function bpsToPercent(bps: number): string {
  return (bps / 100).toString();
}

/** Fee cut in minor units, rounded half-up. Never exceeds the total. */
export function computeFeeMinor(totalMinor: bigint, bps: number): bigint {
  if (bps <= 0 || totalMinor <= 0n) return 0n;
  const b = BigInt(Math.round(bps));
  const cut = (totalMinor * b + 5000n) / 10000n;
  return cut > totalMinor ? totalMinor : cut;
}

/** Parse a major-unit amount string to positive minor units, or null. */
function fixedAmountMinor(amount: string): bigint | null {
  const trimmed = amount.trim();
  if (!trimmed) return null;
  try {
    const m = moneyFromMajor(trimmed);
    return m > 0n ? m : null;
  } catch {
    return null;
  }
}

/** The fee cut in minor units for the live preview, or null if unresolved. */
export function feeCutMinor(
  fee: FeeState,
  totalMinor: bigint | null,
): bigint | null {
  if (fee.mode === "FIXED") return fixedAmountMinor(fee.amount);
  const bps = percentToBps(fee.percent);
  if (bps === null || totalMinor === null) return null;
  return computeFeeMinor(totalMinor, bps);
}

/** API fee fields from the fee state, or null when disabled/invalid. */
export function feePayload(fee: FeeState): Record<string, unknown> | null {
  if (!fee.enabled || !fee.method) return null;
  const label = fee.label.trim() || undefined;
  if (fee.mode === "FIXED") {
    const minor = fixedAmountMinor(fee.amount);
    if (minor === null) return null;
    return { feeMethod: fee.method, feeLabel: label, feeAmount: minor.toString() };
  }
  const bps = percentToBps(fee.percent);
  if (bps === null) return null;
  return { feeMethod: fee.method, feeLabel: label, feeBps: bps };
}

/** Human description for the fee posting line on the ledger. */
export function feeLineDescription(
  method: string | null,
  label: string | null,
  context: string,
): string {
  const channel = method ? feeMethodLabel(method) : "fee";
  const named = label ? `${channel} - ${label}` : channel;
  return `Transaction fee (${named}) on: ${context}`;
}
