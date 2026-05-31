import { z } from "zod";
import type {
  IncomeEntry,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { computeEntryStatus, type EntryStatus } from "@/lib/entry-status";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { AccountRepository } from "@/repositories/account-repository";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { IncomeEntryRepository } from "@/repositories/income-entry-repository";
import { TransactionCategoryRepository } from "@/repositories/transaction-category-repository";
import { PostingFailure, PostingService } from "@/services/posting-service";

const createSchema = z.object({
  clientAccountId: z.string().min(1, "A client account is required"),
  categoryId: z.string().min(1, "A category is required"),
  description: z.string().trim().min(1, "Description is required").max(500),
  totalAmount: z.coerce.bigint().refine((v) => v > 0n, "Total must be positive"),
  entryDate: z.coerce.date(),
  paymentDueOn: z.coerce.date(),
});

export type CreateIncomeInput = z.infer<typeof createSchema>;

export interface IncomeEntryWithStatus extends IncomeEntry {
  status: EntryStatus;
}

function withStatus(entry: IncomeEntry): IncomeEntryWithStatus {
  return {
    ...entry,
    status: computeEntryStatus({
      confirmed: entry.state === "CONFIRMED",
      paymentDueOn: entry.paymentDueOn,
    }),
  };
}

/**
 * Income business logic. Drafts are created freely; confirming an entry
 * recognises the income on the ledger (DR Client receivable, CR Revenue)
 * and marks the entry CONFIRMED - atomically in one DB transaction.
 */
export class IncomeService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listEntries(): Promise<IncomeEntryWithStatus[]> {
    const entries = await new IncomeEntryRepository(this.db).listAll();
    return entries.map(withStatus);
  }

  async getEntry(id: string): Promise<Result<IncomeEntryWithStatus>> {
    const entry = await new IncomeEntryRepository(this.db).findById(id);
    return entry
      ? ok(withStatus(entry))
      : err(`Income entry ${id} was not found`);
  }

  async createDraft(input: unknown): Promise<Result<IncomeEntry>> {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const account = await new AccountRepository(this.db).findById(
      data.clientAccountId,
    );
    if (!account) return err(`Account ${data.clientAccountId} was not found`);
    const category = await new TransactionCategoryRepository(this.db).findById(
      data.categoryId,
    );
    if (!category) return err(`Category ${data.categoryId} was not found`);
    if (category.kind !== "INCOME") {
      return err("Category must be of kind INCOME");
    }

    const entry = await this.db.$transaction(async (tx) => {
      const created = await new IncomeEntryRepository(tx).create({
        clientAccountId: data.clientAccountId,
        categoryId: data.categoryId,
        description: data.description,
        totalAmount: data.totalAmount,
        entryDate: data.entryDate,
        paymentDueOn: data.paymentDueOn,
      });
      await new AuditLogRepository(tx).record({
        action: "CREATE",
        entityType: "IncomeEntry",
        entityId: created.id,
        summary: `Draft income "${created.description}" created (${created.totalAmount.toString()})`,
        after: {
          id: created.id,
          clientAccountId: created.clientAccountId,
          categoryId: created.categoryId,
          totalAmount: created.totalAmount.toString(),
        },
      });
      return created;
    });

    return ok(entry);
  }

  /**
   * Confirm a DRAFT income entry. Posts the full amount through the ledger
   * (DR client account, CR revenue) and marks the entry CONFIRMED - all in
   * one DB transaction. Either both happen or neither does.
   */
  async confirm(
    id: string,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<IncomeEntry>> {
    const entry = await new IncomeEntryRepository(this.db).findById(id);
    if (!entry) return err(`Income entry ${id} was not found`);
    if (entry.state !== "DRAFT") {
      return err(
        `Income entry ${id} cannot be confirmed (state: ${entry.state})`,
      );
    }

    const revenue = await new AccountRepository(this.db).findBySystemKey(
      "REVENUE",
    );
    if (!revenue) {
      return err("Revenue system account is missing - re-run the seed");
    }

    try {
      const confirmed = await this.db.$transaction(async (tx) => {
        await new PostingService().post(tx, {
          entryType: "INCOME",
          sourceType: "INCOME_ENTRY",
          sourceId: entry.id,
          effectiveDate: entry.entryDate,
          description: `Income recognised: ${entry.description}`,
          postings: [
            {
              debitAccountId: entry.clientAccountId,
              creditAccountId: revenue.id,
              amount: entry.totalAmount,
            },
          ],
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        const updated = await new IncomeEntryRepository(tx).markConfirmed(
          entry.id,
        );
        await new AuditLogRepository(tx).record({
          action: "CONFIRM",
          entityType: "IncomeEntry",
          entityId: updated.id,
          summary: `Income "${updated.description}" confirmed`,
          before: { state: "DRAFT" },
          after: {
            state: updated.state,
            confirmedAt: updated.confirmedAt?.toISOString() ?? null,
          },
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        return updated;
      });
      return ok(confirmed);
    } catch (error) {
      if (error instanceof PostingFailure) return err(error.message);
      throw error;
    }
  }
}
