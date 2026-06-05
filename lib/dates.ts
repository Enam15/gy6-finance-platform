/**
 * UTC-safe date helpers for accounting-period math. All boundary dates are
 * anchored at midnight UTC and represent the START of the period; the
 * "end-exclusive" variants point at the start of the NEXT period so callers
 * get clean half-open intervals [start, endExclusive).
 *
 * We use UTC throughout because:
 *   - `entry_date` / `effective_date` are stored as PostgreSQL `date` (no
 *     timezone), and Prisma surfaces them as JS Date at UTC midnight.
 *   - DST transitions can otherwise nudge a quarter boundary by an hour
 *     and put rows on the wrong side of the cut.
 */

import type { RecurrenceUnit } from "@/lib/generated/prisma/client";

/** Start of the calendar quarter containing `at` (midnight UTC). */
export function quarterStart(at: Date = new Date()): Date {
  const y = at.getUTCFullYear();
  const q = Math.floor(at.getUTCMonth() / 3); // 0..3
  return new Date(Date.UTC(y, q * 3, 1));
}

/** Start of the quarter AFTER the one containing `at` (half-open upper bound). */
export function quarterEndExclusive(at: Date = new Date()): Date {
  const y = at.getUTCFullYear();
  const q = Math.floor(at.getUTCMonth() / 3);
  return new Date(Date.UTC(y, q * 3 + 3, 1));
}

/** Start of the calendar year containing `at` (Jan 1 midnight UTC). */
export function yearStart(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), 0, 1));
}

/** Start of the calendar year AFTER the one containing `at`. */
export function yearEndExclusive(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear() + 1, 0, 1));
}

/** Start of the calendar month containing `at` (midnight UTC). */
export function monthStart(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

/**
 * `n` consecutive month-start dates ending with the month containing `at`.
 * Oldest first. monthRangesBack(12) -> [11 months ago start, ..., this month start].
 */
export function monthRangesBack(n: number, at: Date = new Date()): Date[] {
  if (n <= 0) return [];
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth();
  const result: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    result.push(new Date(Date.UTC(y, m - i, 1)));
  }
  return result;
}

/**
 * "YYYY-MM" key for a Date, evaluated in UTC. Used to bucket aggregate rows
 * from PostgreSQL by month with no chance of a timezone-induced miss.
 */
export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Midnight UTC of today's date (date-only, no time component). */
export function todayUtc(at: Date = new Date()): Date {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
}

/**
 * Add a whole number of days to a UTC-midnight date, staying at UTC
 * midnight. Safe across month/year boundaries (Date.UTC normalises).
 */
export function addDaysUtc(d: Date, days: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days),
  );
}

/**
 * Add `months` calendar months to a UTC date, clamping the day to the last
 * day of the target month (Jan 31 + 1 month -> Feb 28, or Feb 29 in a leap
 * year). Note: repeated monthly advances from a month-end start "drift"
 * earlier and do not recover the original day (Jan 31 -> Feb 28 -> Mar 28).
 * Acceptable for renewals, which are typically anchored to early-month
 * dates; an anchor-day field would be over-engineering here.
 */
function addMonthsUtc(d: Date, months: number): Date {
  const day = d.getUTCDate();
  const total = d.getUTCMonth() + months;
  const targetYear = d.getUTCFullYear() + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  // Day 0 of the month after target = last day of target month.
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)),
  );
}

/**
 * Advance a date by one recurrence step (`count` x `unit`), in UTC, with
 * month/year arithmetic clamped to valid days. Used to walk a renewal
 * template's nextRunOn forward.
 */
export function advanceByRecurrence(
  d: Date,
  count: number,
  unit: RecurrenceUnit,
): Date {
  switch (unit) {
    case "DAY":
      return addDaysUtc(d, count);
    case "WEEK":
      return addDaysUtc(d, count * 7);
    case "MONTH":
      return addMonthsUtc(d, count);
    case "YEAR":
      return addMonthsUtc(d, count * 12);
  }
}
