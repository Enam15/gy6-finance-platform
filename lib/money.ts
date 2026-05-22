/**
 * Money value object.
 *
 * Every monetary amount is an integer number of minor units (e.g. cents) held
 * as `bigint`. Floating-point numbers are never used for money. `Money` is a
 * branded type, so a raw number or bigint cannot be passed where money is
 * expected - values are only ever produced through this module's constructors.
 */

/** Minor units in one major unit (e.g. 100 cents in 1 unit of currency). */
export const MINOR_UNITS_PER_MAJOR = 100n;

declare const moneyBrand: unique symbol;

/** An integer monetary amount, in minor units. */
export type Money = bigint & { readonly [moneyBrand]: "Money" };

/** Zero money. */
export const ZERO_MONEY = 0n as Money;

/**
 * Construct Money from an integer number of minor units.
 * Throws if a non-integer `number` is supplied.
 */
export function money(minorUnits: bigint | number): Money {
  if (typeof minorUnits === "number") {
    if (!Number.isInteger(minorUnits)) {
      throw new RangeError(
        `Money requires integer minor units, received ${minorUnits}`,
      );
    }
    return BigInt(minorUnits) as Money;
  }
  return minorUnits as Money;
}

/**
 * Construct Money from a major-unit value such as "1234.56".
 * Parsing is string-based to avoid floating-point rounding error.
 */
export function moneyFromMajor(value: string | number): Money {
  const raw = typeof value === "number" ? value.toFixed(2) : value.trim();
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;

  const parts = unsigned.split(".");
  if (parts.length > 2) {
    throw new RangeError(`Invalid money value: "${value}"`);
  }
  const whole = parts[0] ?? "";
  const fraction = parts[1] ?? "";

  if (!/^\d+$/.test(whole) || (fraction.length > 0 && !/^\d+$/.test(fraction))) {
    throw new RangeError(`Invalid money value: "${value}"`);
  }
  if (fraction.length > 2) {
    throw new RangeError(`Money supports at most 2 decimal places: "${value}"`);
  }

  const minor =
    BigInt(whole) * MINOR_UNITS_PER_MAJOR + BigInt(fraction.padEnd(2, "0"));
  return (negative ? -minor : minor) as Money;
}

/** Add two money amounts. */
export function addMoney(a: Money, b: Money): Money {
  return (a + b) as Money;
}

/** Subtract `b` from `a`. */
export function subtractMoney(a: Money, b: Money): Money {
  return (a - b) as Money;
}

/** Negate a money amount. */
export function negateMoney(a: Money): Money {
  return -a as Money;
}

/** Sum a list of money amounts. */
export function sumMoney(values: readonly Money[]): Money {
  let total = 0n;
  for (const value of values) {
    total += value;
  }
  return total as Money;
}

/** Compare two amounts: -1 if a < b, 0 if equal, 1 if a > b. */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** True when the amount is exactly zero. */
export function isZeroMoney(a: Money): boolean {
  return a === ZERO_MONEY;
}

/** True when the amount is below zero. */
export function isNegativeMoney(a: Money): boolean {
  return a < 0n;
}

/** True when the amount is above zero. */
export function isPositiveMoney(a: Money): boolean {
  return a > 0n;
}

/**
 * Split `total` across the given integer ratios so that no minor unit is lost
 * or created: the returned amounts always sum exactly to `total`. Leftover
 * minor units from integer division are assigned by the largest-remainder
 * method, with earlier ratios winning ties. Used for profit distribution.
 */
export function allocateMoney(total: Money, ratios: readonly bigint[]): Money[] {
  if (ratios.length === 0) {
    throw new RangeError("allocateMoney: at least one ratio is required");
  }
  if (ratios.some((ratio) => ratio < 0n)) {
    throw new RangeError("allocateMoney: ratios must be non-negative");
  }
  const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0n);
  if (totalRatio <= 0n) {
    throw new RangeError("allocateMoney: the ratios must sum to a positive value");
  }

  const sign = total < 0n ? -1n : 1n;
  const absolute = total < 0n ? -total : total;

  const buckets = ratios.map((ratio, index) => {
    const numerator = absolute * ratio;
    return {
      index,
      share: numerator / totalRatio,
      remainder: numerator % totalRatio,
    };
  });

  let leftover = absolute - buckets.reduce((sum, bucket) => sum + bucket.share, 0n);
  const ranked = [...buckets].sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index;
    return b.remainder > a.remainder ? 1 : -1;
  });
  for (const bucket of ranked) {
    if (leftover <= 0n) break;
    bucket.share += 1n;
    leftover -= 1n;
  }

  return buckets.map((bucket) => (bucket.share * sign) as Money);
}

/**
 * Format money as a plain major-unit string with grouped thousands, e.g.
 * 123456n -> "1,234.56". No currency symbol (the system is single-currency).
 */
export function formatMoney(amount: Money): string {
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = absolute / MINOR_UNITS_PER_MAJOR;
  const fraction = absolute % MINOR_UNITS_PER_MAJOR;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fractionStr = fraction.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${wholeStr}.${fractionStr}`;
}
