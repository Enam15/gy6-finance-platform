"use client";

import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeePicker } from "@/components/fee-picker";
import { parseEntryAmountMinor, type EntryFormState } from "@/lib/entry-form";

export interface EntryOption {
  id: string;
  name: string;
}

interface EntryFormFieldsProps {
  kind: "income" | "expense";
  idPrefix: string;
  value: EntryFormState;
  onChange: (next: EntryFormState) => void;
  accounts: EntryOption[];
  categories: EntryOption[];
  submitting?: boolean;
}

/**
 * The shared field set for an income/expense entry: account, category,
 * description, amount, dates, optional fee and notes. Create adds a recurrence
 * picker around this; edit uses it as-is.
 */
export function EntryFormFields({
  kind,
  idPrefix,
  value,
  onChange,
  accounts,
  categories,
  submitting,
}: EntryFormFieldsProps) {
  const accountLabel = kind === "income" ? "Source account" : "Payee account";
  function set<K extends keyof EntryFormState>(key: K, v: EntryFormState[K]) {
    onChange({ ...value, [key]: v });
  }

  // Base UI needs a value->label map to render the trigger label for a value
  // that was set programmatically (e.g. the edit dialog pre-fills these);
  // without it the trigger falls back to showing the raw id.
  const accountItems: Record<string, string> = {};
  for (const a of accounts) accountItems[a.id] = a.name;
  const categoryItems: Record<string, string> = {};
  for (const c of categories) categoryItems[c.id] = c.name;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-account`}>{accountLabel}</Label>
          <Select
            items={accountItems}
            value={value.accountId}
            onValueChange={(v) => set("accountId", v ?? "")}
          >
            <SelectTrigger id={`${idPrefix}-account`}>
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
          <Label htmlFor={`${idPrefix}-category`}>Category</Label>
          <Select
            items={categoryItems}
            value={value.categoryId}
            onValueChange={(v) => set("categoryId", v ?? "")}
          >
            <SelectTrigger id={`${idPrefix}-category`}>
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
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Input
          id={`${idPrefix}-description`}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder={
            kind === "income"
              ? "e.g. May retainer for Acme Corp"
              : "e.g. June salary - Mustafa"
          }
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-amount`}>Amount</Label>
          <NumberInput
            id={`${idPrefix}-amount`}
            value={value.amount}
            onValueChange={(v) => set("amount", v)}
            placeholder="1234.56"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-entry-date`}>Entry date</Label>
          <Input
            id={`${idPrefix}-entry-date`}
            type="date"
            value={value.entryDate}
            onChange={(e) => set("entryDate", e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-due-date`}>Payment due</Label>
          <Input
            id={`${idPrefix}-due-date`}
            type="date"
            value={value.paymentDueOn}
            onChange={(e) => set("paymentDueOn", e.target.value)}
            required
          />
        </div>
      </div>

      <FeePicker
        idPrefix={idPrefix}
        value={value.fee}
        onChange={(fee) => set("fee", fee)}
        totalMinor={parseEntryAmountMinor(value.amount)}
        direction={kind === "income" ? "in" : "out"}
        disabled={submitting}
      />

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notes (optional)</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Anything to remember about this entry"
          rows={3}
          disabled={submitting}
        />
      </div>
    </>
  );
}
