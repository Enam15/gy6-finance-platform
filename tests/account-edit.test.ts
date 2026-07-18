import { describe, expect, it } from "vitest";
import type { DbClient } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { AccountService } from "@/services/account-service";
import { PostingService } from "@/services/posting-service";

/**
 * An account's details are editable; what the ledger derives from it is not.
 * The balance is materialised from postings and moves only by posting an
 * adjustment, and the normal balance decides which way a posting moves that
 * balance - so re-filing an account under a category that would flip it is
 * refused once there is history to invert.
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
 * AccountService opens a $transaction of its own, which a Prisma transaction
 * client doesn't expose. The test is already inside one, so splice in a
 * $transaction that runs the callback on the same tx: still atomic, and the
 * outer rollback still throws all of it away.
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

/** A plain CLIENT-category (DEBIT-normal) account at zero, never posted to. */
async function pristineClientAccount(tx: DbClient) {
  const stamp = `${Date.now()}-${Math.random()}`;
  const clientCategory = await tx.accountCategory.findUniqueOrThrow({
    where: { key: "CLIENT" },
  });
  const subscriptionCategory = await tx.accountCategory.findUniqueOrThrow({
    where: { key: "SUBSCRIPTION" },
  });
  const account = await tx.account.create({
    data: {
      categoryId: clientCategory.id,
      name: `Edit Acct ${stamp}`,
      description: "Original description",
      normalBalance: "DEBIT",
    },
  });
  return {
    service: new AccountService(asServiceDb(tx)),
    account,
    clientCategory,
    subscriptionCategory,
    stamp,
  };
}

describe("editing an account", () => {
  it("renames and re-describes it without touching the balance", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, account, clientCategory } =
        await pristineClientAccount(tx);
      // Give it a balance the way the ledger would, then edit around it.
      await tx.account.update({
        where: { id: account.id },
        data: { balance: 42_000n },
      });

      const result = await service.updateAccount(account.id, {
        name: "Renamed account",
        categoryId: clientCategory.id,
        description: "New description",
      });
      const stored = await tx.account.findUniqueOrThrow({
        where: { id: account.id },
      });
      return { result, stored };
    });

    expect(r.result.ok).toBe(true);
    expect(r.stored.name).toBe("Renamed account");
    expect(r.stored.description).toBe("New description");
    expect(r.stored.balance).toBe(42_000n);
    expect(r.stored.normalBalance).toBe("DEBIT");
  });

  it("refuses a body that carries a balance", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, account, clientCategory } =
        await pristineClientAccount(tx);
      await tx.account.update({
        where: { id: account.id },
        data: { balance: 42_000n },
      });

      const result = await service.updateAccount(account.id, {
        name: "Renamed account",
        categoryId: clientCategory.id,
        balance: "999999",
      });
      const stored = await tx.account.findUniqueOrThrow({
        where: { id: account.id },
      });
      return { result, stored };
    });

    // Rejected outright - not partially applied with the balance dropped.
    expect(r.result.ok).toBe(false);
    expect(r.stored.balance).toBe(42_000n);
    expect(r.stored.name).toMatch(/^Edit Acct/);
  });

  it("refuses a body that carries a normal balance", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, account, clientCategory } =
        await pristineClientAccount(tx);
      return service.updateAccount(account.id, {
        name: "Renamed account",
        categoryId: clientCategory.id,
        normalBalance: "CREDIT",
      });
    });

    expect(r.ok).toBe(false);
  });

  it("refuses a re-file that would flip the normal balance under a posted account", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, account, subscriptionCategory, stamp } =
        await pristineClientAccount(tx);
      const counterparty = await tx.account.create({
        data: {
          categoryId: account.categoryId,
          name: `Edit Counter ${stamp}`,
          normalBalance: "DEBIT",
          allowNegative: true,
        },
      });
      await new PostingService().post(tx, {
        entryType: "TRANSFER",
        sourceType: "TRANSFER",
        sourceId: `acct-edit-${stamp}`,
        effectiveDate: new Date(),
        description: "gives the account a history",
        postings: [
          {
            debitAccountId: account.id,
            creditAccountId: counterparty.id,
            amount: 5_000n,
          },
        ],
      });

      const result = await service.updateAccount(account.id, {
        name: account.name,
        categoryId: subscriptionCategory.id,
      });
      const stored = await tx.account.findUniqueOrThrow({
        where: { id: account.id },
      });
      return { result, stored, clientCategoryId: account.categoryId };
    });

    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.error).toMatch(/flip/i);
    // Neither the filing nor the meaning of its balance moved.
    expect(r.stored.categoryId).toBe(r.clientCategoryId);
    expect(r.stored.normalBalance).toBe("DEBIT");
    expect(r.stored.balance).toBe(5_000n);
  });

  it("allows the same re-file while the account is untouched and at zero", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, account, subscriptionCategory } =
        await pristineClientAccount(tx);
      const result = await service.updateAccount(account.id, {
        name: account.name,
        categoryId: subscriptionCategory.id,
      });
      const stored = await tx.account.findUniqueOrThrow({
        where: { id: account.id },
      });
      return { result, stored, subscriptionId: subscriptionCategory.id };
    });

    expect(r.result.ok).toBe(true);
    expect(r.stored.categoryId).toBe(r.subscriptionId);
    // Nothing has been posted, so there is no history to invert: the normal
    // balance follows the new category.
    expect(r.stored.normalBalance).toBe("CREDIT");
  });

  it("refuses to disallow a negative balance while the account is negative", async () => {
    const r = await runInRollback(async (tx) => {
      const { service, account, clientCategory } =
        await pristineClientAccount(tx);
      await tx.account.update({
        where: { id: account.id },
        data: { balance: -1_000n, allowNegative: true },
      });

      const result = await service.updateAccount(account.id, {
        name: account.name,
        categoryId: clientCategory.id,
        allowNegative: false,
      });
      const stored = await tx.account.findUniqueOrThrow({
        where: { id: account.id },
      });
      return { result, stored };
    });

    expect(r.result.ok).toBe(false);
    expect(r.stored.allowNegative).toBe(true);
  });

  it("refuses to edit a system account", async () => {
    const r = await runInRollback(async (tx) => {
      const revenue = await tx.account.findUniqueOrThrow({
        where: { systemKey: "REVENUE" },
      });
      const service = new AccountService(asServiceDb(tx));
      const result = await service.updateAccount(revenue.id, {
        name: "Renamed revenue",
        categoryId: revenue.categoryId,
      });
      const stored = await tx.account.findUniqueOrThrow({
        where: { id: revenue.id },
      });
      return { result, stored, name: revenue.name };
    });

    expect(r.result.ok).toBe(false);
    expect(r.stored.name).toBe(r.name);
  });

  it("keeps only custom values the category actually defines", async () => {
    const r = await runInRollback(async (tx) => {
      const stamp = `${Date.now()}-${Math.random()}`;
      const category = await tx.accountCategory.create({
        data: {
          name: `Edit Custom ${stamp}`,
          balanceVisible: true,
          normalBalance: "DEBIT",
          customFields: [
            { id: "f-phone", label: "Phone" },
            { id: "f-vat", label: "VAT number" },
          ],
        },
      });
      const account = await tx.account.create({
        data: {
          categoryId: category.id,
          name: `Custom Acct ${stamp}`,
          normalBalance: "DEBIT",
          customValues: { "f-phone": "old" },
        },
      });

      const result = await new AccountService(asServiceDb(tx)).updateAccount(
        account.id,
        {
          name: account.name,
          categoryId: category.id,
          customValues: {
            "f-phone": "  0300 1234567  ",
            "f-vat": "VAT-99",
            "f-bogus": "should not survive",
          },
        },
      );
      const stored = await tx.account.findUniqueOrThrow({
        where: { id: account.id },
      });
      return { result, stored };
    });

    expect(r.result.ok).toBe(true);
    // Trimmed, and the field this category never defined is gone.
    expect(r.stored.customValues).toEqual({
      "f-phone": "0300 1234567",
      "f-vat": "VAT-99",
    });
  });
});
