import { describe, it, expect } from "vitest";
import { addDaysUtc, advanceByRecurrence } from "@/lib/dates";

/** Build a UTC-midnight Date from a YYYY-MM-DD string. */
function d(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Render a Date back to YYYY-MM-DD (UTC). */
function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("addDaysUtc", () => {
  it("adds days across a month boundary", () => {
    expect(iso(addDaysUtc(d("2026-01-30"), 5))).toBe("2026-02-04");
  });

  it("adds days across a year boundary", () => {
    expect(iso(addDaysUtc(d("2026-12-30"), 3))).toBe("2027-01-02");
  });
});

describe("advanceByRecurrence", () => {
  it("advances by days", () => {
    expect(iso(advanceByRecurrence(d("2026-06-05"), 10, "DAY"))).toBe(
      "2026-06-15",
    );
  });

  it("advances by weeks", () => {
    expect(iso(advanceByRecurrence(d("2026-06-05"), 2, "WEEK"))).toBe(
      "2026-06-19",
    );
  });

  it("advances by a simple month", () => {
    expect(iso(advanceByRecurrence(d("2026-01-15"), 1, "MONTH"))).toBe(
      "2026-02-15",
    );
  });

  it("clamps a month-end start to a shorter month", () => {
    expect(iso(advanceByRecurrence(d("2026-01-31"), 1, "MONTH"))).toBe(
      "2026-02-28",
    );
  });

  it("clamps to a leap February", () => {
    expect(iso(advanceByRecurrence(d("2024-01-31"), 1, "MONTH"))).toBe(
      "2024-02-29",
    );
  });

  it("rolls a month over the year boundary", () => {
    expect(iso(advanceByRecurrence(d("2026-12-15"), 1, "MONTH"))).toBe(
      "2027-01-15",
    );
  });

  it("advances by several months at once", () => {
    expect(iso(advanceByRecurrence(d("2026-01-15"), 3, "MONTH"))).toBe(
      "2026-04-15",
    );
  });

  it("advances by a year", () => {
    expect(iso(advanceByRecurrence(d("2026-06-05"), 1, "YEAR"))).toBe(
      "2027-06-05",
    );
  });

  it("clamps a leap day when advancing a year", () => {
    expect(iso(advanceByRecurrence(d("2024-02-29"), 1, "YEAR"))).toBe(
      "2025-02-28",
    );
  });
});
