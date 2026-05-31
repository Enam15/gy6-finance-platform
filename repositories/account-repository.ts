import type {
  Account,
  NormalBalance,
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

  create(data: CreateAccountData): Promise<Account> {
    return this.db.account.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        normalBalance: data.normalBalance,
        description: data.description ?? null,
        allowNegative: data.allowNegative ?? false,
        systemKey: data.systemKey ?? null,
      },
    });
  }
}
