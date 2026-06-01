import { afterAll, describe, expect, it } from "vitest";
import type { DbClient } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { ExpenseEntryRepository } from "@/repositories/expense-entry-repository";
import { IncomeEntryRepository } from "@/repositories/income-entry-repository";
import { StatementEntryRepository } from "@/repositories/statement-entry-repository";
import { PostingService } from "@/services/posting-service";

/**
 * Integration tests for Phase 2B's read-side query additions. Each test runs
 * inside a Prisma $transaction we deliberately roll back, so no data
 * persists between runs.
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
  const slot: { value?: T } = {};
  try {
    await prisma.$transaction(async (tx) => {
      slot.value = await fn(tx);
      throw new RollbackSentinel();
    });
  } catch (error) {
    if (!(error instanceof RollbackSentinel)) throw error;
  }
  if (slot.value === undefined) {
    throw new Error("runInRollback: callback did not return a value");
  }
  return slot.value;
}

describe("StatementEntryRepository.listByAccount (integration)", () => {
  it("returns the same entry whether queried from the DR or the CR side", async () => {
    const result = await runInRollback(async (tx) => {
      const businessCat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "BUSINESS" },
      });
      const from = await tx.account.create({
        data: {
          categoryId: businessCat.id,
          name: `T From ${Date.now()}`,
          normalBalance: "DEBIT",
          balance: 1000n,
        },
      });
      const to = await tx.account.create({
        data: {
          categoryId: businessCat.id,
          name: `T To ${Date.now()}`,
          normalBalance: "DEBIT",
        },
      });

      await new PostingService().post(tx, {
        entryType: "TRANSFER",
        sourceType: "TRANSFER",
        sourceId: `t-lba-${Date.now()}`,
        effectiveDate: new Date(),
        description: "listByAccount fixture",
        postings: [
          { debitAccountId: to.id, creditAccountId: from.id, amount: 500n },
        ],
      });

      const repo = new StatementEntryRepository(tx);
      const drListed = await repo.listByAccount(to.id, 10);
      const crListed = await repo.listByAccount(from.id, 10);
      return { drListed, crListed, fromId: from.id, toId: to.id };
    });

    expect(result.drListed).toHaveLength(1);
    expect(result.crListed).toHaveLength(1);
    expect(result.drListed[0]?.id).toBe(result.crListed[0]?.id);
    expect(result.drListed[0]?.debitAccountId).toBe(result.toId);
    expect(result.drListed[0]?.creditAccountId).toBe(result.fromId);
    expect(result.drListed[0]?.amount).toBe(500n);
  });
});

describe("StatementEntryRepository.listRecent (integration)", () => {
  it("returns entries newest-first by effective date", async () => {
    const ours = await runInRollback(async (tx) => {
      const businessCat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "BUSINESS" },
      });
      const a = await tx.account.create({
        data: {
          categoryId: businessCat.id,
          name: `T A ${Date.now()}`,
          normalBalance: "DEBIT",
          balance: 1000n,
        },
      });
      const b = await tx.account.create({
        data: {
          categoryId: businessCat.id,
          name: `T B ${Date.now()}`,
          normalBalance: "DEBIT",
        },
      });

      const earlier = new Date("2026-01-01T12:00:00Z");
      const later = new Date("2026-06-01T12:00:00Z");

      const posting = new PostingService();
      await posting.post(tx, {
        entryType: "TRANSFER",
        sourceType: "TRANSFER",
        sourceId: `t-recent-early-${Date.now()}`,
        effectiveDate: earlier,
        description: "Earlier posting",
        postings: [
          { debitAccountId: b.id, creditAccountId: a.id, amount: 100n },
        ],
      });
      await posting.post(tx, {
        entryType: "TRANSFER",
        sourceType: "TRANSFER",
        sourceId: `t-recent-late-${Date.now()}`,
        effectiveDate: later,
        description: "Later posting",
        postings: [
          { debitAccountId: b.id, creditAccountId: a.id, amount: 200n },
        ],
      });

      const recent = await new StatementEntryRepository(tx).listRecent(50);
      return recent.filter(
        (e) => e.debitAccountId === b.id && e.creditAccountId === a.id,
      );
    });

    expect(ours).toHaveLength(2);
    expect(ours[0]?.description).toBe("Later posting");
    expect(ours[1]?.description).toBe("Earlier posting");
  });
});

describe("IncomeEntryRepository.sumOutstandingForClient (integration)", () => {
  it("aggregates amount_due across CONFIRMED entries and ignores DRAFT", async () => {
    const sum = await runInRollback(async (tx) => {
      const clientCat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "CLIENT" },
      });
      const txCat = await tx.transactionCategory.create({
        data: { name: `T Inc ${Date.now()}`, kind: "INCOME" },
      });
      const client = await tx.account.create({
        data: {
          categoryId: clientCat.id,
          name: `T Client ${Date.now()}`,
          normalBalance: "DEBIT",
        },
      });
      const now = new Date();

      await tx.incomeEntry.create({
        data: {
          clientAccountId: client.id,
          categoryId: txCat.id,
          description: "Confirmed full",
          totalAmount: 500n,
          amountPaid: 0n,
          amountDue: 500n,
          entryDate: now,
          paymentDueOn: now,
          state: "CONFIRMED",
          confirmedAt: now,
        },
      });
      await tx.incomeEntry.create({
        data: {
          clientAccountId: client.id,
          categoryId: txCat.id,
          description: "Confirmed partial",
          totalAmount: 300n,
          amountPaid: 100n,
          amountDue: 200n,
          entryDate: now,
          paymentDueOn: now,
          state: "CONFIRMED",
          confirmedAt: now,
        },
      });
      await tx.incomeEntry.create({
        data: {
          clientAccountId: client.id,
          categoryId: txCat.id,
          description: "Draft, should be ignored",
          totalAmount: 1000n,
          amountPaid: 0n,
          amountDue: 1000n,
          entryDate: now,
          paymentDueOn: now,
          state: "DRAFT",
        },
      });

      return new IncomeEntryRepository(tx).sumOutstandingForClient(client.id);
    });

    expect(sum).toBe(700n);
  });
});

describe("ExpenseEntryRepository.sumOutstandingForPayee (integration)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("aggregates amount_due across CONFIRMED entries and ignores DRAFT", async () => {
    const sum = await runInRollback(async (tx) => {
      const employeeCat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "EMPLOYEE" },
      });
      const txCat = await tx.transactionCategory.create({
        data: { name: `T Exp ${Date.now()}`, kind: "EXPENSE" },
      });
      const payee = await tx.account.create({
        data: {
          categoryId: employeeCat.id,
          name: `T Payee ${Date.now()}`,
          normalBalance: "CREDIT",
        },
      });
      const now = new Date();

      await tx.expenseEntry.create({
        data: {
          payeeAccountId: payee.id,
          categoryId: txCat.id,
          description: "Confirmed full",
          totalAmount: 400n,
          amountPaid: 0n,
          amountDue: 400n,
          entryDate: now,
          paymentDueOn: now,
          state: "CONFIRMED",
          confirmedAt: now,
        },
      });
      await tx.expenseEntry.create({
        data: {
          payeeAccountId: payee.id,
          categoryId: txCat.id,
          description: "Confirmed partial",
          totalAmount: 600n,
          amountPaid: 250n,
          amountDue: 350n,
          entryDate: now,
          paymentDueOn: now,
          state: "CONFIRMED",
          confirmedAt: now,
        },
      });
      await tx.expenseEntry.create({
        data: {
          payeeAccountId: payee.id,
          categoryId: txCat.id,
          description: "Draft, should be ignored",
          totalAmount: 999n,
          amountPaid: 0n,
          amountDue: 999n,
          entryDate: now,
          paymentDueOn: now,
          state: "DRAFT",
        },
      });

      return new ExpenseEntryRepository(tx).sumOutstandingForPayee(payee.id);
    });

    expect(sum).toBe(750n);
  });
});
