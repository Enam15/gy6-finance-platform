import { afterAll, describe, expect, it } from "vitest";
import type { DbClient } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { PostingFailure, PostingService } from "@/services/posting-service";

/**
 * Integration tests for the posting engine, run against the live gy6_finance
 * dev database. Each test wraps its work in a Prisma transaction that we
 * deliberately roll back, so no test data persists.
 */

class RollbackSentinel extends Error {
  constructor() {
    super("rollback");
    this.name = "RollbackSentinel";
  }
}

async function runInRollback<T>(
  fn: (tx: DbClient) => Promise<T>,
): Promise<T> {
  let captured: { value: T } | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      captured = { value: await fn(tx) };
      throw new RollbackSentinel();
    });
  } catch (error) {
    if (!(error instanceof RollbackSentinel)) throw error;
  }
  if (!captured) {
    throw new Error("runInRollback: callback did not return a value");
  }
  return captured.value;
}

describe("PostingService (integration)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("increases a debit-normal account on a debit posting", async () => {
    const result = await runInRollback(async (tx) => {
      const businessCat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "BUSINESS" },
      });
      const business = await tx.account.create({
        data: {
          categoryId: businessCat.id,
          name: `TEST Bank ${Date.now()}`,
          normalBalance: "DEBIT",
        },
      });
      const revenueBefore = await tx.account.findUniqueOrThrow({
        where: { systemKey: "REVENUE" },
      });

      const posted = await new PostingService().post(tx, {
        entryType: "INCOME",
        sourceType: "INCOME_ENTRY",
        sourceId: `test-income-${Date.now()}`,
        effectiveDate: new Date(),
        description: "Test income posting",
        postings: [
          {
            debitAccountId: business.id,
            creditAccountId: revenueBefore.id,
            amount: 10000n,
          },
        ],
      });

      const businessAfter = await tx.account.findUniqueOrThrow({
        where: { id: business.id },
      });
      const revenueAfter = await tx.account.findUniqueOrThrow({
        where: { systemKey: "REVENUE" },
      });

      return {
        posted,
        businessBalance: businessAfter.balance,
        revenueDelta: revenueAfter.balance - revenueBefore.balance,
      };
    });

    expect(result.posted.entries).toHaveLength(1);
    const entry = result.posted.entries[0];
    expect(entry?.amount).toBe(10000n);
    // Debit-normal account receiving a debit: balance grows by the amount.
    expect(result.businessBalance).toBe(10000n);
    // Credit-normal Revenue account receiving a credit: balance grows by the amount.
    expect(result.revenueDelta).toBe(10000n);
  });

  it("rejects a posting that would push a balance below zero", async () => {
    await expect(
      runInRollback(async (tx) => {
        const businessCat = await tx.accountCategory.findUniqueOrThrow({
          where: { key: "BUSINESS" },
        });
        const empty = await tx.account.create({
          data: {
            categoryId: businessCat.id,
            name: `TEST Empty ${Date.now()}`,
            normalBalance: "DEBIT",
            allowNegative: false,
          },
        });
        const target = await tx.account.create({
          data: {
            categoryId: businessCat.id,
            name: `TEST Target ${Date.now()}`,
            normalBalance: "DEBIT",
            allowNegative: true,
          },
        });
        // Crediting an empty debit-normal account would take it to -5000.
        await new PostingService().post(tx, {
          entryType: "TRANSFER",
          sourceType: "TRANSFER",
          sourceId: `test-overdraw-${Date.now()}`,
          effectiveDate: new Date(),
          description: "Should fail (insufficient funds)",
          postings: [
            {
              debitAccountId: target.id,
              creditAccountId: empty.id,
              amount: 5000n,
            },
          ],
        });
      }),
    ).rejects.toBeInstanceOf(PostingFailure);
  });

  it("rejects a zero amount", async () => {
    await expect(
      runInRollback(async (tx) => {
        const businessCat = await tx.accountCategory.findUniqueOrThrow({
          where: { key: "BUSINESS" },
        });
        const a = await tx.account.create({
          data: {
            categoryId: businessCat.id,
            name: `T A ${Date.now()}`,
            normalBalance: "DEBIT",
          },
        });
        const b = await tx.account.create({
          data: {
            categoryId: businessCat.id,
            name: `T B ${Date.now()}`,
            normalBalance: "DEBIT",
          },
        });
        await new PostingService().post(tx, {
          entryType: "TRANSFER",
          sourceType: "TRANSFER",
          sourceId: `test-zero-${Date.now()}`,
          effectiveDate: new Date(),
          description: "zero amount",
          postings: [
            { debitAccountId: a.id, creditAccountId: b.id, amount: 0n },
          ],
        });
      }),
    ).rejects.toBeInstanceOf(PostingFailure);
  });

  it("rejects the same account on both sides of a posting", async () => {
    await expect(
      runInRollback(async (tx) => {
        const businessCat = await tx.accountCategory.findUniqueOrThrow({
          where: { key: "BUSINESS" },
        });
        const a = await tx.account.create({
          data: {
            categoryId: businessCat.id,
            name: `T Self ${Date.now()}`,
            normalBalance: "DEBIT",
          },
        });
        await new PostingService().post(tx, {
          entryType: "TRANSFER",
          sourceType: "TRANSFER",
          sourceId: `test-self-${Date.now()}`,
          effectiveDate: new Date(),
          description: "self-posting",
          postings: [
            { debitAccountId: a.id, creditAccountId: a.id, amount: 100n },
          ],
        });
      }),
    ).rejects.toBeInstanceOf(PostingFailure);
  });

  it("a reversal restores both account balances to their starting state", async () => {
    const balances = await runInRollback(async (tx) => {
      const businessCat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "BUSINESS" },
      });
      const fromAccount = await tx.account.create({
        data: {
          categoryId: businessCat.id,
          name: `T From ${Date.now()}`,
          normalBalance: "DEBIT",
          balance: 5000n,
        },
      });
      const toAccount = await tx.account.create({
        data: {
          categoryId: businessCat.id,
          name: `T To ${Date.now()}`,
          normalBalance: "DEBIT",
        },
      });

      const original = await new PostingService().post(tx, {
        entryType: "TRANSFER",
        sourceType: "TRANSFER",
        sourceId: `test-transfer-${Date.now()}`,
        effectiveDate: new Date(),
        description: "Original transfer",
        postings: [
          {
            debitAccountId: toAccount.id,
            creditAccountId: fromAccount.id,
            amount: 5000n,
          },
        ],
      });

      const midFrom = (
        await tx.account.findUniqueOrThrow({ where: { id: fromAccount.id } })
      ).balance;
      const midTo = (
        await tx.account.findUniqueOrThrow({ where: { id: toAccount.id } })
      ).balance;

      const originalEntry = original.entries[0];
      if (!originalEntry) throw new Error("expected one posting in group");

      await new PostingService().post(tx, {
        entryType: "REVERSAL",
        sourceType: "TRANSFER",
        sourceId: `test-transfer-${Date.now()}`,
        effectiveDate: new Date(),
        description: "Reversal",
        postings: [
          {
            debitAccountId: originalEntry.creditAccountId,
            creditAccountId: originalEntry.debitAccountId,
            amount: originalEntry.amount,
            reversesEntryId: originalEntry.id,
          },
        ],
      });

      const finalFrom = (
        await tx.account.findUniqueOrThrow({ where: { id: fromAccount.id } })
      ).balance;
      const finalTo = (
        await tx.account.findUniqueOrThrow({ where: { id: toAccount.id } })
      ).balance;

      return { midFrom, midTo, finalFrom, finalTo };
    });

    expect(balances.midFrom).toBe(0n);
    expect(balances.midTo).toBe(5000n);
    expect(balances.finalFrom).toBe(5000n);
    expect(balances.finalTo).toBe(0n);
  });
});
