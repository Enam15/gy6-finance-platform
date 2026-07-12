"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
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
 * navigates (server re-renders the dashboard for the chosen period). Pass
 * `null` for a value to remove that param.
 */
function useParamSetter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) sp.delete(key);
      else sp.set(key, value);
    }
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
  const quarterItems = Object.fromEntries(QUARTERS.map((n) => [String(n), `Q${n}`]));
  const yearItems = Object.fromEntries(years.map((y) => [String(y), String(y)]));
  return (
    <div className="flex gap-2">
      <Select
        items={quarterItems}
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
        items={yearItems}
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

/**
 * Range picker for the Charts card. Rolling-window presets plus two options
 * that follow the top Quarter/Year selections, so choosing a quarter or year
 * up top reflects straight onto the charts.
 */
export function ChartRangePicker({
  range,
  quarter,
  quarterYear,
  year,
}: {
  range: string;
  quarter: number;
  quarterYear: number;
  year: number;
}) {
  const setParam = useParamSetter();
  const rangeItems: Record<string, string> = {
    "6m": "Last 6 months",
    "12m": "Last 12 months",
    "24m": "Last 24 months",
    quarter: `Q${quarter} ${quarterYear}`,
    year: `Year ${year}`,
    custom: "Custom range",
  };
  return (
    <Select
      items={rangeItems}
      value={range}
      // Choosing a preset clears any custom calendar range.
      onValueChange={(v) => setParam({ range: v ?? "12m", from: null, to: null })}
    >
      <SelectTrigger className="w-[170px]" aria-label="Chart range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="6m">Last 6 months</SelectItem>
        <SelectItem value="12m">Last 12 months</SelectItem>
        <SelectItem value="24m">Last 24 months</SelectItem>
        <SelectItem value="quarter">
          Q{quarter} {quarterYear}
        </SelectItem>
        <SelectItem value="year">Year {year}</SelectItem>
      </SelectContent>
    </Select>
  );
}

/**
 * Calendar range for the charts: two native date inputs (each opens the OS
 * calendar). When both are set the dashboard shows the months spanning them;
 * clearing either falls back to the preset range.
 */
export function ChartRangeCalendar({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const setParam = useParamSetter();
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="date"
        aria-label="Chart range start date"
        value={from}
        max={to || undefined}
        onChange={(e) => setParam({ from: e.target.value || null })}
        className="h-8 w-[148px]"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        aria-label="Chart range end date"
        value={to}
        min={from || undefined}
        onChange={(e) => setParam({ to: e.target.value || null })}
        className="h-8 w-[148px]"
      />
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
  const yearItems = Object.fromEntries(years.map((y) => [String(y), String(y)]));
  return (
    <Select
      items={yearItems}
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
