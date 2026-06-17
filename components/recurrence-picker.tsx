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
import {
  REPEAT_OPTIONS,
  UNIT_OPTIONS,
  type RecurrenceState,
  type RecurrenceUnitName,
  type RepeatChoice,
} from "@/lib/recurrence";

interface RecurrencePickerProps {
  idPrefix: string;
  value: RecurrenceState;
  onChange: (next: RecurrenceState) => void;
  disabled?: boolean;
}

/**
 * "Repeat" control for the income/expense dialogs. Emits a RecurrenceState;
 * the dialog turns it into a renewal template via lib/recurrence helpers.
 */
export function RecurrencePicker({
  idPrefix,
  value,
  onChange,
  disabled,
}: RecurrencePickerProps) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-repeat`}>Repeat</Label>
        <Select
          value={value.repeat}
          onValueChange={(v) =>
            onChange({ ...value, repeat: (v as RepeatChoice) ?? "none" })
          }
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-repeat`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPEAT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.repeat === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-every`}>Every</Label>
            <Input
              id={`${idPrefix}-every`}
              type="number"
              min={1}
              max={120}
              value={value.customCount}
              onChange={(e) =>
                onChange({ ...value, customCount: e.target.value })
              }
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-unit`}>Unit</Label>
            <Select
              value={value.customUnit}
              onValueChange={(v) =>
                onChange({
                  ...value,
                  customUnit: (v as RecurrenceUnitName) ?? "MONTH",
                })
              }
              disabled={disabled}
            >
              <SelectTrigger id={`${idPrefix}-unit`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {value.repeat !== "none" && (
        <p className="text-xs text-muted-foreground">
          This entry is created now; a renewal template generates the next ones
          automatically. Manage or pause it on the Renewals page.
        </p>
      )}
    </div>
  );
}
