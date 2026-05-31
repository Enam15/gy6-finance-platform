import { z } from "zod";
import type {
  Account,
  AccountCategoryKey,
  NormalBalance,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { AccountRepository } from "@/repositories/account-repository";
import { AccountCategoryRepository } from "@/repositories/account-category-repository";
import { AuditLogRepository } from "@/repositories/audit-log-repository";

const createAccountSchema = z.object({
  categoryId: z.string().min(1, "A category is required"),
  name: z.string().trim().min(1, "Account name is required").max(120),
  description: z.string().trim().max(500).optional(),
  allowNegative: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

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

  /** All accounts, ordered by name. */
  listAccounts(): Promise<Account[]> {
    return new AccountRepository(this.db).listAll();
  }

  /** A single account by id. */
  async getAccount(id: string): Promise<Result<Account>> {
    const account = await new AccountRepository(this.db).findById(id);
    return account ? ok(account) : err(`Account ${id} was not found`);
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
