"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

interface NumberInputProps
  extends Omit<ComponentProps<typeof Input>, "onChange" | "value" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Allow a decimal point (default true). Ignored when `tel` is set. */
  decimal?: boolean;
  /** Allow a leading minus (default false). Ignored when `tel` is set. */
  allowNegative?: boolean;
  /**
   * Phone mode: allow digits plus the usual phone punctuation
   * (`+ - ( ) space`) but block letters. Use for phone/fax numbers.
   */
  tel?: boolean;
}

function sanitize(
  raw: string,
  { decimal, allowNegative, tel }: Pick<NumberInputProps, "decimal" | "allowNegative" | "tel">,
): string {
  // Phone numbers: keep digits and phone punctuation only.
  if (tel) return raw.replace(/[^\d+\-() ]/g, "");

  const negative = allowNegative && raw.trimStart().startsWith("-");
  let s = raw.replace(/[^\d.]/g, "");
  if (!decimal) {
    s = s.replace(/\./g, "");
  } else {
    const dot = s.indexOf(".");
    if (dot !== -1) {
      s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
    }
  }
  return (negative ? "-" : "") + s;
}

/** Text input that only accepts numeric characters (blocks letters). */
export function NumberInput({
  value,
  onValueChange,
  decimal = true,
  allowNegative = false,
  tel = false,
  ...props
}: NumberInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode={tel ? "tel" : decimal ? "decimal" : "numeric"}
      value={value}
      onChange={(e) =>
        onValueChange(sanitize(e.target.value, { decimal, allowNegative, tel }))
      }
    />
  );
}
