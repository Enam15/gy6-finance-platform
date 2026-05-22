import type {
  AccountCategory,
  AccountCategoryKey,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

/** Fields accepted when creating an account category. */
export interface CreateAccountCategoryData {
  key: AccountCategoryKey;
  name: string;
  balanceVisible: boolean;
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

  create(data: CreateAccountCategoryData): Promise<AccountCategory> {
    return this.db.accountCategory.create({
      data: {
        key: data.key,
        name: data.name,
        balanceVisible: data.balanceVisible,
        isSystem: data.isSystem ?? false,
      },
    });
  }
}
