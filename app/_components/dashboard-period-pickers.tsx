"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const QUARTERS = [1, 2, 3, 4];

/**
 * Hook returning a setter that merges params into the current URL query and
 * navigates (server re-renders the dashboard for the chosen period).
 */
function useParamSetter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) sp.set(key, value);
    router.push(`${pathname}?${sp.toString()}`);
  };
}

/** Quarter (Q1-Q4) + year picker for the dashboard's quarter section. */
export function QuarterPicker({
  quarter,
  year,
  years,
}: {
  quarter: number;
  year: number;
  years: number[];
}) {
  const setParam = useParamSetter();
  return (
    <div className="flex gap-2">
      <Select
        value={String(quarter)}
        onValueChange={(v) => setParam({ q: v ?? String(quarter) })}
      >
        <SelectTrigger className="w-[84px]" aria-label="Quarter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUARTERS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              Q{n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(year)}
        onValueChange={(v) => setParam({ qy: v ?? String(year) })}
      >
        <SelectTrigger className="w-[96px]" aria-label="Quarter year">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Year picker for the dashboard's year section. */
export function YearPicker({
  year,
  years,
}: {
  year: number;
  years: number[];
}) {
  const setParam = useParamSetter();
  return (
    <Select
      value={String(year)}
      onValueChange={(v) => setParam({ y: v ?? String(year) })}
    >
      <SelectTrigger className="w-[96px]" aria-label="Year">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
