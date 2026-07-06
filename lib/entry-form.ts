/**
 * Shared client-side form state for income and expense entries, so the create
 * and edit dialogs stay in lockstep. The only structural difference between an
 * income and an expense entry is which account role the counterparty plays
 * (client vs. payee), which the callers map to `accountId`.
 */

import {
  DEFAULT_FEE,
  bpsToPercent,
  type FeeMethodName,
  type FeeState,
} from "@/lib/fees";
import { formatMoneyForInput, money, moneyFromMajor } from "@/lib/money";

export type EntryStateValue = "DRAFT" | "CONFIRMED" | "REVERSED";

/** An income/expense entry flattened to strings for the client boundary. */
export interface SerializedEntry {
  id: string;
  /** clientAccountId (income) or payeeAccountId (expense). */
  accountId: string;
  categoryId: string;
  description: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  entryDate: string; // yyyy-mm-dd
  paymentDueOn: string; // yyyy-mm-dd
  state: EntryStateValue;
  status: string;
  feeMethod: string | null;
  feeLabel: string | null;
  feeBps: number | null;
  feeAmount: string | null;
  notes: string | null;
  createdAt: string; // ISO
}

export interface EntryFormState {
  accountId: string;
  categoryId: string;
  description: string;
  amount: string; // major units
  entryDate: string; // yyyy-mm-dd
  paymentDueOn: string; // yyyy-mm-dd
  notes: string;
  fee: FeeState;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function blankEntryForm(): EntryFormState {
  return {
    accountId: "",
    categoryId: "",
    description: "",
    amount: "",
    entryDate: todayIso(),
    paymentDueOn: todayIso(),
    notes: "",
    fee: { ...DEFAULT_FEE },
  };
}

/** Rebuild editable form state from a stored entry (for the edit dialog). */
export function entryToForm(entry: SerializedEntry): EntryFormState {
  const hasFee = !!entry.feeMethod;
  const isFixed = hasFee && entry.feeBps == null && entry.feeAmount != null;
  return {
    accountId: entry.accountId,
    categoryId: entry.categoryId,
    description: entry.description,
    amount: formatMoneyForInput(money(BigInt(entry.totalAmount))),
    entryDate: entry.entryDate,
    paymentDueOn: entry.paymentDueOn,
    notes: entry.notes ?? "",
    fee: {
      enabled: hasFee,
      method: (entry.feeMethod as FeeMethodName) ?? "BANK",
      label: entry.feeLabel ?? "",
      mode: isFixed ? "FIXED" : "PERCENT",
      percent: entry.feeBps != null ? bpsToPercent(entry.feeBps) : "",
      amount:
        isFixed && entry.feeAmount != null
          ? formatMoneyForInput(money(BigInt(entry.feeAmount)))
          : "",
    },
  };
}

/** Parse the amount field to positive minor units, or null if not yet valid. */
export function parseEntryAmountMinor(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const m = moneyFromMajor(trimmed);
    return m > 0n ? m : null;
  } catch {
    return null;
  }
}
