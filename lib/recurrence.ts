/**
 * Client-safe helpers for the "Repeat" option on income/expense entries.
 *
 * Picking a frequency creates the entry now (occurrence 1) plus a
 * RenewalTemplate whose first run is the NEXT occurrence, so "Generate due
 * renewals" never duplicates the entry the user just made. The date math
 * here only sets that first nextRunOn; every later occurrence is advanced
 * server-side by advanceByRecurrence in the renewal service.
 */

export type RepeatChoice =
  | "none"
  | "daily"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type RecurrenceUnitName = "DAY" | "WEEK" | "MONTH" | "YEAR";

export interface RecurrenceState {
  repeat: RepeatChoice;
  customCount: string;
  customUnit: RecurrenceUnitName;
}

export const DEFAULT_RECURRENCE: RecurrenceState = {
  repeat: "none",
  customCount: "1",
  customUnit: "MONTH",
};

export interface ResolvedInterval {
  intervalCount: number;
  intervalUnit: RecurrenceUnitName;
}

export const REPEAT_OPTIONS: { value: RepeatChoice; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom…" },
];

export const UNIT_OPTIONS: { value: RecurrenceUnitName; label: string }[] = [
  { value: "DAY", label: "days" },
  { value: "WEEK", label: "weeks" },
  { value: "MONTH", label: "months" },
  { value: "YEAR", label: "years" },
];

/**
 * Map a repeat choice to a concrete interval, or null when it doesn't repeat
 * (or a custom count is invalid).
 */
export function resolveInterval(
  state: RecurrenceState,
): ResolvedInterval | null {
  switch (state.repeat) {
    case "none":
      return null;
    case "daily":
      return { intervalCount: 1, intervalUnit: "DAY" };
    case "monthly":
      return { intervalCount: 1, intervalUnit: "MONTH" };
    case "quarterly":
      return { intervalCount: 3, intervalUnit: "MONTH" };
    case "yearly":
      return { intervalCount: 1, intervalUnit: "YEAR" };
    case "custom": {
      const n = Number.parseInt(state.customCount, 10);
      if (!Number.isFinite(n) || n < 1) return null;
      return { intervalCount: n, intervalUnit: state.customUnit };
    }
  }
}

/**
 * The next occurrence (YYYY-MM-DD) after `fromIso`, advanced by one interval.
 * Uses UTC so it never shifts across a day boundary by timezone.
 */
export function nextOccurrenceIso(
  fromIso: string,
  interval: ResolvedInterval,
): string {
  const parts = fromIso.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const { intervalCount, intervalUnit } = interval;
  switch (intervalUnit) {
    case "DAY":
      dt.setUTCDate(dt.getUTCDate() + intervalCount);
      break;
    case "WEEK":
      dt.setUTCDate(dt.getUTCDate() + intervalCount * 7);
      break;
    case "MONTH":
      dt.setUTCMonth(dt.getUTCMonth() + intervalCount);
      break;
    case "YEAR":
      dt.setUTCFullYear(dt.getUTCFullYear() + intervalCount);
      break;
  }
  return dt.toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso`; negative spans clamp to 0. */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  const days = Math.round((to - from) / 86_400_000);
  return days > 0 ? days : 0;
}
