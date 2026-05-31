import { describe, expect, it } from "vitest";
import {
  addMoney,
  allocateMoney,
  compareMoney,
  formatMoney,
  isNegativeMoney,
  isPositiveMoney,
  isZeroMoney,
  money,
  moneyFromMajor,
  negateMoney,
  subtractMoney,
  sumMoney,
  ZERO_MONEY,
} from "@/lib/money";

describe("money", () => {
  describe("moneyFromMajor", () => {
    it("parses integer strings", () => {
      expect(moneyFromMajor("100")).toBe(10000n);
    });
    it("parses decimal strings", () => {
      expect(moneyFromMajor("100.50")).toBe(10050n);
    });
    it("parses single-decimal strings", () => {
      expect(moneyFromMajor("0.5")).toBe(50n);
    });
    it("parses negative values", () => {
      expect(moneyFromMajor("-100.50")).toBe(-10050n);
    });
    it("parses numbers via toFixed", () => {
      expect(moneyFromMajor(100.5)).toBe(10050n);
    });
    it("rejects garbage", () => {
      expect(() => moneyFromMajor("abc")).toThrow();
    });
    it("rejects too many decimal places", () => {
      expect(() => moneyFromMajor("1.234")).toThrow();
    });
    it("rejects multiple dots", () => {
      expect(() => moneyFromMajor("1.2.3")).toThrow();
    });
  });

  describe("arithmetic", () => {
    it("adds", () => {
      expect(addMoney(money(100n), money(50n))).toBe(150n);
    });
    it("subtracts", () => {
      expect(subtractMoney(money(100n), money(30n))).toBe(70n);
    });
    it("negates", () => {
      expect(negateMoney(money(100n))).toBe(-100n);
    });
    it("sums lists", () => {
      expect(sumMoney([money(10n), money(20n), money(30n)])).toBe(60n);
    });
    it("compares", () => {
      expect(compareMoney(money(10n), money(20n))).toBe(-1);
      expect(compareMoney(money(10n), money(10n))).toBe(0);
      expect(compareMoney(money(20n), money(10n))).toBe(1);
    });
  });

  describe("allocateMoney (the 65/35 profit split)", () => {
    it("splits cleanly when the amount divides evenly", () => {
      const parts = allocateMoney(money(10000n), [65n, 35n]);
      expect(parts).toEqual([6500n, 3500n]);
    });

    it("sums to total exactly on an odd amount", () => {
      const parts = allocateMoney(money(10001n), [65n, 35n]);
      expect(parts.reduce((a, b) => a + b, 0n)).toBe(10001n);
    });

    it("never loses or invents a minor unit across any amount", () => {
      for (let amount = 1; amount < 1000; amount++) {
        const parts = allocateMoney(money(BigInt(amount)), [65n, 35n]);
        expect(parts.reduce((a, b) => a + b, 0n)).toBe(BigInt(amount));
      }
    });

    it("handles negative totals symmetrically", () => {
      const parts = allocateMoney(money(-10000n), [65n, 35n]);
      expect(parts).toEqual([-6500n, -3500n]);
      expect(parts.reduce((a, b) => a + b, 0n)).toBe(-10000n);
    });

    it("handles three-way splits", () => {
      const parts = allocateMoney(money(100n), [1n, 1n, 1n]);
      expect(parts.reduce((a, b) => a + b, 0n)).toBe(100n);
    });

    it("rejects empty ratios", () => {
      expect(() => allocateMoney(money(100n), [])).toThrow();
    });

    it("rejects negative ratios", () => {
      expect(() => allocateMoney(money(100n), [-1n, 1n])).toThrow();
    });

    it("rejects zero-sum ratios", () => {
      expect(() => allocateMoney(money(100n), [0n, 0n])).toThrow();
    });
  });

  describe("formatMoney", () => {
    it("formats with thousand separators", () => {
      expect(formatMoney(money(123456n))).toBe("1,234.56");
      expect(formatMoney(money(1000000n))).toBe("10,000.00");
    });
    it("pads decimals", () => {
      expect(formatMoney(money(10n))).toBe("0.10");
      expect(formatMoney(money(5n))).toBe("0.05");
    });
    it("formats negatives", () => {
      expect(formatMoney(money(-12345n))).toBe("-123.45");
    });
    it("formats zero", () => {
      expect(formatMoney(ZERO_MONEY)).toBe("0.00");
    });
  });

  describe("predicates", () => {
    it("classifies zero / positive / negative", () => {
      expect(isZeroMoney(ZERO_MONEY)).toBe(true);
      expect(isZeroMoney(money(1n))).toBe(false);
      expect(isPositiveMoney(money(1n))).toBe(true);
      expect(isPositiveMoney(money(-1n))).toBe(false);
      expect(isNegativeMoney(money(-1n))).toBe(true);
    });
  });
});
