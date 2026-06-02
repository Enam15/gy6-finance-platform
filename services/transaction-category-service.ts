import { z } from "zod";
import type {
  CategoryKind,
  PrismaClient,
  TransactionCategory,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { TransactionCategoryRepository } from "@/repositories/transaction-category-repository";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  kind: z.enum(["INCOME", "EXPENSE"]),
});

export type CreateTransactionCategoryInput = z.infer<typeof createSchema>;

/**
 * Transaction-category business logic - the labels users attach to income
 * and expense entries (e.g. "Project Fee", "Salary", "Software").
 */
export class TransactionCategoryService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listByKind(kind: CategoryKind): Promise<TransactionCategory[]> {
    return new TransactionCategoryRepository(this.db).listByKind(kind);
  }

  listAll(): Promise<TransactionCategory[]> {
    return new TransactionCategoryRepository(this.db).listAll();
  }

  async create(
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<TransactionCategory>> {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const category = await this.db.$transaction(async (tx) => {
      const created = await new TransactionCategoryRepository(tx).create({
        name: data.name,
        kind: data.kind,
      });
      await new AuditLogRepository(tx).record({
        action: "CREATE",
        entityType: "TransactionCategory",
        entityId: created.id,
        summary: `Transaction category "${created.name}" created (${created.kind})`,
        after: { id: created.id, name: created.name, kind: created.kind },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return created;
    });

    return ok(category);
  }
}
