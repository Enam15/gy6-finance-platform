import type {
  CategoryKind,
  TransactionCategory,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

export interface CreateTransactionCategoryData {
  name: string;
  kind: CategoryKind;
}

/**
 * Data access for transaction categories (income / expense labels). These
 * are distinct from account categories, which classify accounts.
 */
export class TransactionCategoryRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<TransactionCategory | null> {
    return this.db.transactionCategory.findUnique({ where: { id } });
  }

  listByKind(kind: CategoryKind): Promise<TransactionCategory[]> {
    return this.db.transactionCategory.findMany({
      where: { kind, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  listAll(): Promise<TransactionCategory[]> {
    return this.db.transactionCategory.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
  }

  create(data: CreateTransactionCategoryData): Promise<TransactionCategory> {
    return this.db.transactionCategory.create({
      data: {
        name: data.name,
        kind: data.kind,
      },
    });
  }
}
