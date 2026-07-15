import { describe, expect, it } from "vitest";
import type { DbClient } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { IncomeEntryRepository } from "@/repositories/income-entry-repository";
import { ExpenseEntryRepository } from "@/repositories/expense-entry-repository";

/**
 * Verifies the "Money owed to you" / "Money you owe" figures (sum of
 * amount_due over CONFIRMED entries) track money moving:
 *   - a DRAFT entry is not counted,
 *   - confirming it adds the full amount,
 *   - recording a payment reduces it (paying in full zeroes it out).
 *
 * The payment step mirrors exactly what PaymentService.record*Payment does to
 * the entry inside its transaction (amount_paid += x, amount_due -= x); this
 * also exercises the DB check that amount_due == total_amount - amount_paid.
 * Runs inside a rolled-back transaction so nothing persists.
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

const TOTAL = 100_000n;

describe("outstanding totals update as money moves", () => {
  it("income (money owed to you): draft=0, confirm adds, payment reduces", async () => {
    const r = await runInRollback(async (tx) => {
      const cat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "CLIENT" },
      });
      const client = await tx.account.create({
        data: {
          categoryId: cat.id,
          name: `T Client ${Date.now()}`,
          normalBalance: "DEBIT",
        },
      });
      const txCat = await tx.transactionCategory.create({
        data: { name: `T Inc ${Date.now()}`, kind: "INCOME" },
      });
      const repo = new IncomeEntryRepository(tx);
      const entry = await repo.create({
        clientAccountId: client.id,
        categoryId: txCat.id,
        description: "Test income",
        totalAmount: TOTAL,
        entryDate: new Date(),
        paymentDueOn: new Date(),
      });
      const draft = await repo.sumOutstandingForClient(client.id);
      await repo.markConfirmed(entry.id);
      const confirmed = await repo.sumOutstandingForClient(client.id);
      // What recordIncomePayment does to the entry on a full payment:
      await tx.incomeEntry.update({
        where: { id: entry.id },
        data: {
          amountPaid: { increment: TOTAL },
          amountDue: { decrement: TOTAL },
        },
      });
      const paid = await repo.sumOutstandingForClient(client.id);
      return { draft, confirmed, paid };
    });
    expect(r.draft).toBe(0n);
    expect(r.confirmed).toBe(TOTAL);
    expect(r.paid).toBe(0n);
  });

  it("expense (money you owe): draft=0, confirm adds, payment reduces", async () => {
    const r = await runInRollback(async (tx) => {
      const cat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "EMPLOYEE" },
      });
      const payee = await tx.account.create({
        data: {
          categoryId: cat.id,
          name: `T Payee ${Date.now()}`,
          normalBalance: "CREDIT",
        },
      });
      const txCat = await tx.transactionCategory.create({
        data: { name: `T Exp ${Date.now()}`, kind: "EXPENSE" },
      });
      const repo = new ExpenseEntryRepository(tx);
      const entry = await repo.create({
        payeeAccountId: payee.id,
        categoryId: txCat.id,
        description: "Test expense",
        totalAmount: TOTAL,
        entryDate: new Date(),
        paymentDueOn: new Date(),
      });
      const draft = await repo.sumOutstandingForPayee(payee.id);
      await repo.markConfirmed(entry.id);
      const confirmed = await repo.sumOutstandingForPayee(payee.id);
      // What recordExpensePayment does to the entry on a full payment:
      await tx.expenseEntry.update({
        where: { id: entry.id },
        data: {
          amountPaid: { increment: TOTAL },
          amountDue: { decrement: TOTAL },
        },
      });
      const paid = await repo.sumOutstandingForPayee(payee.id);
      return { draft, confirmed, paid };
    });
    expect(r.draft).toBe(0n);
    expect(r.confirmed).toBe(TOTAL);
    expect(r.paid).toBe(0n);
  });
});
