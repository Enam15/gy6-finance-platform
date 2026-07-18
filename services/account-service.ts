import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  Account,
  AccountCategory,
  NormalBalance,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { parseCustomFields } from "@/lib/account-fields";
import { AccountRepository } from "@/repositories/account-repository";
import { AccountCategoryRepository } from "@/repositories/account-category-repository";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { ExpenseEntryRepository } from "@/repositories/expense-entry-repository";
import { IncomeEntryRepository } from "@/repositories/income-entry-repository";

const createAccountSchema = z.object({
  categoryId: z.string().min(1, "A category is required"),
  name: z.string().trim().min(1, "Account name is required").max(120),
  description: z.string().trim().max(500).optional(),
  allowNegative: z.boolean().optional(),
  allowBalanceAdjust: z.boolean().optional(),
  /** Values for the category's custom fields, keyed by field id. */
  customValues: z.record(z.string(), z.string()).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/**
 * What an account edit may carry. Strict so a body that also tries to set a
 * balance, a normal balance or a system key is rejected outright rather than
 * quietly stripped: none of those are an edit's to make.
 */
const updateAccountSchema = z.strictObject({
  categoryId: z.string().min(1, "A category is required"),
  name: z.string().trim().min(1, "Account name is required").max(120),
  description: z.string().trim().max(500).nullish(),
  allowNegative: z.boolean().optional(),
  /** Values for the category's custom fields, keyed by field id. */
  customValues: z.record(z.string(), z.string()).optional(),
});

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "A category name is required").max(60),
  /**
   * How accounts in this category behave on the ledger. Framed for users as
   * "money you have" (DEBIT, asset-like) vs "money you owe" (CREDIT).
   */
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  balanceVisible: z.boolean().optional(),
  /** Custom field labels to attach to accounts in this category. */
  fields: z
    .array(z.object({ label: z.string().trim().min(1).max(60) }))
    .max(20)
    .optional(),
});

export type CreateAccountCategoryInput = z.infer<typeof createCategorySchema>;

/** Bundled view of an account for the detail page. */
export interface AccountDetail {
  account: Account;
  category: AccountCategory;
  /** Sum of amount_due across CONFIRMED income entries where this account is the client. */
  outstandingIncome: bigint;
  /** Sum of amount_due across CONFIRMED expense entries where this account is the payee. */
  outstandingExpense: bigint;
}

/**
 * Derive an account's normal balance from its category. Built-in categories
 * key off their stable enum: Business, Client and Founder are debit-normal
 * (cash, client receivables and founder distributions all grow on debit);
 * Employee and Subscription are credit-normal (payables grow on credit).
 * Custom categories (no key) carry their own normalBalance instead.
 */
function normalBalanceForCategory(category: AccountCategory): NormalBalance {
  if (category.key) {
    switch (category.key) {
      case "BUSINESS":
      case "CLIENT":
      case "FOUNDER":
        return "DEBIT";
      case "EMPLOYEE":
      case "SUBSCRIPTION":
        return "CREDIT";
      case "SYSTEM":
        throw new Error(
          "SYSTEM category accounts are seeded, not created through the service",
        );
    }
  }
  if (category.normalBalance) return category.normalBalance;
  throw new Error(`Category "${category.name}" is missing a normal balance`);
}

/**
 * Account business logic. Reads go straight through a repository; writes run
 * inside a database transaction and always record an audit log entry, so a
 * record never changes without a traceable event behind it.
 */
export class AccountService {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** All accounts, ordered by name (includes hidden system accounts). */
  listAccounts(): Promise<Account[]> {
    return new AccountRepository(this.db).listAll();
  }

  /** Visible accounts (user-facing, not archived) for the UI. */
  listVisible(): Promise<Account[]> {
    return new AccountRepository(this.db).listVisible();
  }

  /** Active Business-category accounts only - source/destination for cash flows. */
  listBusinessAccounts(): Promise<Account[]> {
    return new AccountRepository(this.db).listBusinessAccounts();
  }

  /** Sigma balance over active Business-category accounts (cash on hand KPI). */
  sumCashOnHand(): Promise<bigint> {
    return new AccountRepository(this.db).sumCashOnHand();
  }

  /** Categories users can pick when creating an account. */
  listSelectableCategories(): Promise<AccountCategory[]> {
    return new AccountCategoryRepository(this.db).listSelectable();
  }

  /** A single account by id. */
  async getAccount(id: string): Promise<Result<Account>> {
    const account = await new AccountRepository(this.db).findById(id);
    return account ? ok(account) : err(`Account ${id} was not found`);
  }

  /**
   * Full account detail for the /accounts/[id] page: account, its category,
   * and the two outstanding aggregates. The outstanding totals are 0 for
   * accounts that aren't the client or payee on any confirmed entry.
   */
  async getDetail(id: string): Promise<Result<AccountDetail>> {
    const account = await new AccountRepository(this.db).findById(id);
    if (!account) return err(`Account ${id} was not found`);

    const [category, outstandingIncome, outstandingExpense] = await Promise.all(
      [
        new AccountCategoryRepository(this.db).findById(account.categoryId),
        new IncomeEntryRepository(this.db).sumOutstandingForClient(id),
        new ExpenseEntryRepository(this.db).sumOutstandingForPayee(id),
      ],
    );

    if (!category) {
      return err(
        `Category ${account.categoryId} was not found for account ${id}`,
      );
    }

    return ok({ account, category, outstandingIncome, outstandingExpense });
  }

  /**
   * Create a user-facing account. System accounts are seeded, never created
   * through this path. `normalBalance` is derived from the category.
   */
  async createAccount(
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<Account>> {
    const parsed = createAccountSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((issue) => issue.message).join("; "));
    }
    const data = parsed.data;

    const category = await new AccountCategoryRepository(this.db).findById(
      data.categoryId,
    );
    if (!category) {
      return err(`Account category ${data.categoryId} was not found`);
    }
    if (category.isSystem) {
      return err("Accounts cannot be created under the system category");
    }

    const normalBalance = normalBalanceForCategory(category);

    // Keep only values for fields this category actually defines.
    const fieldIds = new Set(
      parseCustomFields(category.customFields).map((f) => f.id),
    );
    const customValues: Record<string, string> = {};
    for (const [fieldId, value] of Object.entries(data.customValues ?? {})) {
      if (fieldIds.has(fieldId) && value.trim()) {
        customValues[fieldId] = value.trim();
      }
    }

    const account = await this.db.$transaction(async (tx) => {
      const created = await new AccountRepository(tx).create({
        categoryId: data.categoryId,
        name: data.name,
        normalBalance,
        description: data.description ?? null,
        allowNegative: data.allowNegative ?? false,
        allowBalanceAdjust: data.allowBalanceAdjust ?? true,
        customValues:
          Object.keys(customValues).length > 0 ? customValues : undefined,
      });
      await new AuditLogRepository(tx).record({
        action: "CREATE",
        entityType: "Account",
        entityId: created.id,
        summary: `Account "${created.name}" created`,
        after: {
          id: created.id,
          name: created.name,
          categoryId: created.categoryId,
          normalBalance: created.normalBalance,
        },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return created;
    });

    return ok(account);
  }

  /**
   * Edit an account's details: its name, description, category, custom field
   * values and negative-balance policy.
   *
   * Two things are never an edit's to change. The balance is materialised
   * from postings, so it moves only through a ledger event (that's what an
   * adjustment is for) and isn't in the schema at all. The normal balance is
   * derived from the category and decides which way a posting moves that
   * balance - so re-filing an account under a category that would flip it is
   * refused unless the account has never been posted to and sits at zero,
   * where there is no history to invert.
   */
  async updateAccount(
    id: string,
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<Account>> {
    const parsed = updateAccountSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((issue) => issue.message).join("; "));
    }
    const data = parsed.data;

    const repo = new AccountRepository(this.db);
    const existing = await repo.findById(id);
    if (!existing) return err(`Account ${id} was not found`);
    if (existing.systemKey) {
      return err(
        `"${existing.name}" is a system account that the ledger posts against - it cannot be edited`,
      );
    }

    const category = await new AccountCategoryRepository(this.db).findById(
      data.categoryId,
    );
    if (!category) {
      return err(`Account category ${data.categoryId} was not found`);
    }
    if (category.isSystem) {
      return err("Accounts cannot be moved into the system category");
    }

    const normalBalance = normalBalanceForCategory(category);
    if (normalBalance !== existing.normalBalance) {
      const postings = await repo.countPostings(id);
      if (postings > 0 || existing.balance !== 0n) {
        return err(
          `Moving "${existing.name}" to ${category.name} would flip it from ${existing.normalBalance}-normal to ${normalBalance}-normal, inverting what its balance means. Its history already depends on the current one, so create a new account under ${category.name} instead.`,
        );
      }
    }

    if (data.allowNegative === false && existing.balance < 0n) {
      return err(
        `"${existing.name}" is already at a negative balance, so it cannot be set to disallow one. Bring it back to zero or above first.`,
      );
    }

    // Keep only values for fields the (possibly new) category defines, so a
    // re-filed account doesn't carry the old category's values around.
    const fieldIds = new Set(
      parseCustomFields(category.customFields).map((f) => f.id),
    );
    const customValues: Record<string, string> = {};
    for (const [fieldId, value] of Object.entries(data.customValues ?? {})) {
      if (fieldIds.has(fieldId) && value.trim()) {
        customValues[fieldId] = value.trim();
      }
    }

    const account = await this.db.$transaction(async (tx) => {
      const updated = await new AccountRepository(tx).updateDetails(id, {
        categoryId: data.categoryId,
        name: data.name,
        normalBalance,
        description: data.description ?? null,
        allowNegative: data.allowNegative ?? existing.allowNegative,
        customValues,
      });
      await new AuditLogRepository(tx).record({
        action: "UPDATE",
        entityType: "Account",
        entityId: updated.id,
        summary: `Account "${updated.name}" edited`,
        before: {
          name: existing.name,
          categoryId: existing.categoryId,
          description: existing.description,
          allowNegative: existing.allowNegative,
          customValues: existing.customValues,
        },
        after: {
          name: updated.name,
          categoryId: updated.categoryId,
          description: updated.description,
          allowNegative: updated.allowNegative,
          customValues: updated.customValues,
        },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return updated;
    });

    return ok(account);
  }

  /** Turn the "Adjust balance" action on or off for an account. */
  async setBalanceAdjustable(
    id: string,
    allow: boolean,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<Account>> {
    const account = await new AccountRepository(this.db).findById(id);
    if (!account) return err(`Account ${id} was not found`);
    if (account.allowBalanceAdjust === allow) return ok(account);

    const updated = await this.db.$transaction(async (tx) => {
      const u = await new AccountRepository(tx).setBalanceAdjustable(id, allow);
      await new AuditLogRepository(tx).record({
        action: "UPDATE",
        entityType: "Account",
        entityId: id,
        summary: `Balance adjustment ${allow ? "enabled" : "disabled"} for "${u.name}"`,
        before: { allowBalanceAdjust: account.allowBalanceAdjust },
        after: { allowBalanceAdjust: u.allowBalanceAdjust },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return u;
    });
    return ok(updated);
  }

  /**
   * Create a user-defined account category with an explicit normal balance
   * and optional custom fields. These sit alongside the seeded built-in
   * categories; accounts created under them behave normally on the ledger.
   */
  async createCategory(
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<AccountCategory>> {
    const parsed = createCategorySchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const customFields = (data.fields ?? []).map((f) => ({
      id: randomUUID(),
      label: f.label,
    }));

    const category = await this.db.$transaction(async (tx) => {
      const created = await new AccountCategoryRepository(tx).create({
        key: null,
        name: data.name,
        balanceVisible: data.balanceVisible ?? true,
        normalBalance: data.normalBalance,
        customFields,
        isSystem: false,
      });
      await new AuditLogRepository(tx).record({
        action: "CREATE",
        entityType: "AccountCategory",
        entityId: created.id,
        summary: `Account category "${created.name}" created`,
        after: {
          id: created.id,
          name: created.name,
          normalBalance: created.normalBalance,
          fields: customFields.map((f) => f.label),
        },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return created;
    });

    return ok(category);
  }
}
