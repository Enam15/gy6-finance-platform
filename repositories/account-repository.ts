import type {
  Account,
  NormalBalance,
  Prisma,
  SystemAccountKey,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

/**
 * Fields accepted when creating an account. `balance` always starts at zero
 * and is only ever changed by ledger events; `systemKey` is set only for the
 * seeded internal system accounts. `normalBalance` is required - which side
 * of the account a debit posting falls on.
 */
export interface CreateAccountData {
  categoryId: string;
  name: string;
  normalBalance: NormalBalance;
  description?: string | null;
  allowNegative?: boolean;
  systemKey?: SystemAccountKey | null;
  /** Values for the category's custom fields, as a { fieldId: value } map. */
  customValues?: Prisma.InputJsonValue;
}

/**
 * Data access for accounts. Construct with the request's Prisma client or a
 * transaction client. Contains no business logic.
 */
export class AccountRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<Account | null> {
    return this.db.account.findUnique({ where: { id } });
  }

  findBySystemKey(systemKey: SystemAccountKey): Promise<Account | null> {
    return this.db.account.findUnique({ where: { systemKey } });
  }

  listAll(): Promise<Account[]> {
    return this.db.account.findMany({ orderBy: { name: "asc" } });
  }

  listByCategory(categoryId: string): Promise<Account[]> {
    return this.db.account.findMany({
      where: { categoryId },
      orderBy: { name: "asc" },
    });
  }

  /** Visible accounts: user-facing only (excludes seeded system accounts) and active. */
  listVisible(): Promise<Account[]> {
    return this.db.account.findMany({
      where: { systemKey: null, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Active Business-category accounts only - the set of accounts that can
   * hold real cash. Used by payment / transfer flows where the source or
   * destination must be a Business account.
   */
  listBusinessAccounts(): Promise<Account[]> {
    return this.db.account.findMany({
      where: {
        systemKey: null,
        isActive: true,
        category: { key: "BUSINESS" },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Sum of balances across active Business-category accounts. This is the
   * "cash on hand" KPI - what GY6 actually has in operational accounts.
   */
  async sumCashOnHand(): Promise<bigint> {
    const result = await this.db.account.aggregate({
      where: {
        systemKey: null,
        isActive: true,
        category: { key: "BUSINESS" },
      },
      _sum: { balance: true },
    });
    return result._sum.balance ?? 0n;
  }

  create(data: CreateAccountData): Promise<Account> {
    return this.db.account.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        normalBalance: data.normalBalance,
        description: data.description ?? null,
        allowNegative: data.allowNegative ?? false,
        systemKey: data.systemKey ?? null,
        customValues: data.customValues ?? undefined,
      },
    });
  }

  /**
   * The Transaction Fees system account (DEBIT-normal, like Expense), created
   * on first use so it exists in every environment without a manual seed.
   * Call inside the posting transaction so creation rolls back with it.
   */
  async findOrCreateTransactionFeesAccount(): Promise<Account> {
    const existing = await this.db.account.findUnique({
      where: { systemKey: "TRANSACTION_FEES" },
    });
    if (existing) return existing;

    const systemCategory = await this.db.accountCategory.findUnique({
      where: { key: "SYSTEM" },
    });
    if (!systemCategory) {
      throw new Error("SYSTEM account category is missing - re-run the seed");
    }
    return this.db.account.create({
      data: {
        categoryId: systemCategory.id,
        name: "Transaction Fees",
        description:
          "Counter-account for bank / Upwork / online-wallet fees recorded as a real cost.",
        systemKey: "TRANSACTION_FEES",
        normalBalance: "DEBIT",
        allowNegative: false,
      },
    });
  }
}
