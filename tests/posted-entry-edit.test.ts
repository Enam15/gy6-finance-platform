import { describe, expect, it } from "vitest";
import type { DbClient } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { IncomeEntryRepository } from "@/repositories/income-entry-repository";
import { ExpenseEntryRepository } from "@/repositories/expense-entry-repository";
import { IncomeService } from "@/services/income-service";
import { ExpenseService } from "@/services/expense-service";

/**
 * A confirmed income/expense entry has already posted to the immutable
 * ledger, so it stays editable only where the books don't depend on it:
 * category, description, payment due date and notes. Amount, account, entry
 * date and fee are corrected by reversing, never by editing.
 *
 * These tests pin the server-side half of that rule - the edit dialog locks
 * the same fields, but the dialog is not what protects the books.
 */

class RollbackSentinel extends Error {}

async function runInRollback<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
  const slot: { value?: T } = {};
  try {
    await prisma.$transaction(async (tx) => {
      slot.value = await fn(tx);
      throw new RollbackSentinel();
    });
  } catch (error) {
    if (!(error instanceof RollbackSentinel)) throw error;
  }
  if (slot.value === undefined) throw new Error("no value");
  return slot.value;
}

/**
 * The services open a $transaction of their own, which a Prisma transaction
 * client doesn't expose. The test is already inside one, so splice in a
 * $transaction that runs the callback on the same tx: the work is still
 * atomic, and the outer rollback still throws all of it away.
 */
function asServiceDb(tx: DbClient): PrismaClient {
  return new Proxy(tx, {
    get(target, prop, receiver) {
      if (prop === "$transaction") {
        return (fn: (client: DbClient) => unknown) => fn(target);
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as PrismaClient;
}

const TOTAL = 250_000n;
const DATE = new Date("2026-03-01");
const DUE = new Date("2026-03-31");

/** A confirmed income entry, its client account and two income categories. */
async function confirmedIncome(tx: DbClient) {
  const stamp = `${Date.now()}-${Math.random()}`;
  const accountCategory = await tx.accountCategory.findUniqueOrThrow({
    where: { key: "CLIENT" },
  });
  const client = await tx.account.create({
    data: {
      categoryId: accountCategory.id,
      name: `Edit Client ${stamp}`,
      normalBalance: "DEBIT",
    },
  });
  const other = await tx.account.create({
    data: {
      categoryId: accountCategory.id,
      name: `Edit Other ${stamp}`,
      normalBalance: "DEBIT",
    },
  });
  const category = await tx.transactionCategory.create({
    data: { name: `Edit Inc ${stamp}`, kind: "INCOME" },
  });
  const reCategory = await tx.transactionCategory.create({
    data: { name: `Edit Inc Alt ${stamp}`, kind: "INCOME" },
  });
  const entry = await new IncomeEntryRepository(tx).create({
    clientAccountId: client.id,
    categoryId: category.id,
    description: "Original wording",
    totalAmount: TOTAL,
    entryDate: DATE,
    paymentDueOn: DUE,
  });

  const service = new IncomeService(asServiceDb(tx));
  const confirmed = await service.confirm(entry.id);
  if (!confirmed.ok) throw new Error(`fixture confirm failed: ${confirmed.error}`);

  return { service, entry, client, other, category, reCategory };
}

/** The body the edit dialog sends for a posted entry. */
function relabel(categoryId: string) {
  return {
    categoryId,
    description: "Corrected wording",
    paymentDueOn: "2026-04-30",
    notes: "Fixed a typo",
  };
}

describe("editing a posted income entry", () => {
  it("accepts a re-label and leaves the ledger posting untouched", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, entry, reCategory } = await confirmedIncome(tx);
      const before = await tx.statementEntry.findFirstOrThrow({
        where: { sourceType: "INCOME_ENTRY", sourceId: entry.id },
      });

      const result = await service.update(entry.id, relabel(reCategory.id));

      const after = await tx.statementEntry.findFirstOrThrow({
        where: { sourceType: "INCOME_ENTRY", sourceId: entry.id },
      });
      const stored = await tx.incomeEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      const postings = await tx.statementEntry.count({
        where: { sourceType: "INCOME_ENTRY", sourceId: entry.id },
      });
      return { result, before, after, stored, postings, reCategory };
    });

    expect(r.result.ok).toBe(true);
    // The entry now reads the way it was corrected...
    expect(r.stored.description).toBe("Corrected wording");
    expect(r.stored.categoryId).toBe(r.reCategory.id);
    expect(r.stored.notes).toBe("Fixed a typo");
    expect(r.stored.paymentDueOn.toISOString().slice(0, 10)).toBe("2026-04-30");
    // ...while the posting keeps every fact the books rest on, including the
    // wording it was actually posted with.
    expect(r.postings).toBe(1);
    expect(r.after.amount).toBe(r.before.amount);
    expect(r.after.debitAccountId).toBe(r.before.debitAccountId);
    expect(r.after.creditAccountId).toBe(r.before.creditAccountId);
    expect(r.after.effectiveDate).toEqual(r.before.effectiveDate);
    expect(r.after.description).toBe(r.before.description);
  });

  it("does not disturb the amount, dates or payment progress", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, entry, reCategory } = await confirmedIncome(tx);
      // Part-pay it first: a re-label must not rewrite what is still owed.
      await tx.incomeEntry.update({
        where: { id: entry.id },
        data: { amountPaid: { increment: 100_000n }, amountDue: { decrement: 100_000n } },
      });

      const result = await service.update(entry.id, relabel(reCategory.id));
      const stored = await tx.incomeEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      return { result, stored };
    });

    expect(r.result.ok).toBe(true);
    expect(r.stored.totalAmount).toBe(TOTAL);
    expect(r.stored.amountPaid).toBe(100_000n);
    expect(r.stored.amountDue).toBe(TOTAL - 100_000n);
    expect(r.stored.entryDate).toEqual(DATE);
    expect(r.stored.state).toBe("CONFIRMED");
  });

  it("refuses a body that carries a new amount", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, entry, reCategory } = await confirmedIncome(tx);
      const result = await service.update(entry.id, {
        ...relabel(reCategory.id),
        totalAmount: "1",
      });
      const stored = await tx.incomeEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      return { result, stored };
    });

    expect(r.result.ok).toBe(false);
    // Rejected outright - not partially applied with the amount dropped.
    expect(r.stored.totalAmount).toBe(TOTAL);
    expect(r.stored.description).toBe("Original wording");
  });

  it("refuses a body that carries a different account", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, entry, other, reCategory } = await confirmedIncome(tx);
      const result = await service.update(entry.id, {
        ...relabel(reCategory.id),
        clientAccountId: other.id,
      });
      const stored = await tx.incomeEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      return { result, stored, client: entry.clientAccountId };
    });

    expect(r.result.ok).toBe(false);
    expect(r.stored.clientAccountId).toBe(r.client);
  });

  it("refuses a body that carries a new entry date", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, entry, reCategory } = await confirmedIncome(tx);
      const result = await service.update(entry.id, {
        ...relabel(reCategory.id),
        entryDate: "2026-01-01",
      });
      const stored = await tx.incomeEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      return { result, stored };
    });

    expect(r.result.ok).toBe(false);
    expect(r.stored.entryDate).toEqual(DATE);
  });

  it("refuses to re-file it under an expense category", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, entry } = await confirmedIncome(tx);
      const wrongKind = await tx.transactionCategory.create({
        data: { name: `Edit Exp ${Date.now()}-${Math.random()}`, kind: "EXPENSE" },
      });
      return service.update(entry.id, relabel(wrongKind.id));
    });

    expect(r.ok).toBe(false);
  });

  it("refuses any edit once the entry is reversed", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, entry, reCategory } = await confirmedIncome(tx);
      // Straight to the state the reversal flow lands on: what is under test
      // here is the edit guard, not how it got there.
      await tx.incomeEntry.update({
        where: { id: entry.id },
        data: { state: "REVERSED" },
      });
      return service.update(entry.id, relabel(reCategory.id));
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/reversed/i);
  });

  it("still lets a draft change its amount", async () => {
    const r = await runInRollback(async (tx) => {
      const stamp = `${Date.now()}-${Math.random()}`;
      const accountCategory = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "CLIENT" },
      });
      const client = await tx.account.create({
        data: {
          categoryId: accountCategory.id,
          name: `Draft Client ${stamp}`,
          normalBalance: "DEBIT",
        },
      });
      const category = await tx.transactionCategory.create({
        data: { name: `Draft Inc ${stamp}`, kind: "INCOME" },
      });
      const entry = await new IncomeEntryRepository(tx).create({
        clientAccountId: client.id,
        categoryId: category.id,
        description: "Draft wording",
        totalAmount: TOTAL,
        entryDate: DATE,
        paymentDueOn: DUE,
      });

      const result = await new IncomeService(asServiceDb(tx)).update(entry.id, {
        clientAccountId: client.id,
        categoryId: category.id,
        description: "Draft reworded",
        totalAmount: "999",
        entryDate: "2026-05-05",
        paymentDueOn: "2026-05-30",
        notes: null,
      });
      const stored = await tx.incomeEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      return { result, stored };
    });

    expect(r.result.ok).toBe(true);
    expect(r.stored.totalAmount).toBe(999n);
    // A draft has no payments, so what's due tracks the new total.
    expect(r.stored.amountDue).toBe(999n);
  });
});

describe("editing a posted expense entry", () => {
  it("accepts a re-label but refuses a new amount", async () => {
    const r = await runInRollback(async (tx) => {
      const stamp = `${Date.now()}-${Math.random()}`;
      const accountCategory = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "SUBSCRIPTION" },
      });
      const payee = await tx.account.create({
        data: {
          categoryId: accountCategory.id,
          name: `Edit Payee ${stamp}`,
          normalBalance: "CREDIT",
        },
      });
      const category = await tx.transactionCategory.create({
        data: { name: `Edit Exp ${stamp}`, kind: "EXPENSE" },
      });
      const entry = await new ExpenseEntryRepository(tx).create({
        payeeAccountId: payee.id,
        categoryId: category.id,
        description: "Original wording",
        totalAmount: TOTAL,
        entryDate: DATE,
        paymentDueOn: DUE,
      });
      const service = new ExpenseService(asServiceDb(tx));
      const confirmed = await service.confirm(entry.id);
      if (!confirmed.ok) throw new Error(`fixture: ${confirmed.error}`);

      const relabelled = await service.update(entry.id, relabel(category.id));
      const afterRelabel = await tx.expenseEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      const withAmount = await service.update(entry.id, {
        ...relabel(category.id),
        totalAmount: "1",
      });
      const finalState = await tx.expenseEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      return { relabelled, afterRelabel, withAmount, finalState };
    });

    expect(r.relabelled.ok).toBe(true);
    expect(r.afterRelabel.description).toBe("Corrected wording");
    expect(r.withAmount.ok).toBe(false);
    expect(r.finalState.totalAmount).toBe(TOTAL);
  });
});
