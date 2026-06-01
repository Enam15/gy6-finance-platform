import { z } from "zod";
import type {
  Account,
  AccountCategory,
  AccountCategoryKey,
  NormalBalance,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
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
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

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
 * Derive an account's normal balance from its category. In the movement-based
 * ledger: Business, Client and Founder accounts are debit-normal (cash,
 * client receivables and founder distributions all grow on debit); Employee
 * and Subscription accounts are credit-normal (payables grow on credit).
 */
function normalBalanceForCategory(key: AccountCategoryKey): NormalBalance {
  switch (key) {
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
  async createAccount(input: unknown): Promise<Result<Account>> {
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

    const normalBalance = normalBalanceForCategory(category.key);

    const account = await this.db.$transaction(async (tx) => {
      const created = await new AccountRepository(tx).create({
        categoryId: data.categoryId,
        name: data.name,
        normalBalance,
        description: data.description ?? null,
        allowNegative: data.allowNegative ?? false,
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
      });
      return created;
    });

    return ok(account);
  }
}
