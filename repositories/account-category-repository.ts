import type {
  AccountCategory,
  AccountCategoryKey,
  NormalBalance,
  Prisma,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

/** Fields accepted when creating an account category. */
export interface CreateAccountCategoryData {
  /** Null for user-created custom categories. */
  key?: AccountCategoryKey | null;
  name: string;
  balanceVisible: boolean;
  /** Required for custom categories (no key to derive it from). */
  normalBalance?: NormalBalance | null;
  /** Custom field definitions, stored as JSON. */
  customFields?: Prisma.InputJsonValue;
  isSystem?: boolean;
}

/** Data access for account categories. Contains no business logic. */
export class AccountCategoryRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<AccountCategory | null> {
    return this.db.accountCategory.findUnique({ where: { id } });
  }

  findByKey(key: AccountCategoryKey): Promise<AccountCategory | null> {
    return this.db.accountCategory.findUnique({ where: { key } });
  }

  listAll(): Promise<AccountCategory[]> {
    return this.db.accountCategory.findMany({ orderBy: { name: "asc" } });
  }

  /** Categories users can pick when creating an account (system category excluded). */
  listSelectable(): Promise<AccountCategory[]> {
    return this.db.accountCategory.findMany({
      where: { isSystem: false },
      orderBy: { name: "asc" },
    });
  }

  create(data: CreateAccountCategoryData): Promise<AccountCategory> {
    return this.db.accountCategory.create({
      data: {
        key: data.key ?? null,
        name: data.name,
        balanceVisible: data.balanceVisible,
        normalBalance: data.normalBalance ?? null,
        customFields: data.customFields ?? undefined,
        isSystem: data.isSystem ?? false,
      },
    });
  }
}
