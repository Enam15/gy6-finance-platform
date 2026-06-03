import { z } from "zod";
import type {
  ExpenseEntry,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { computeEntryStatus, type EntryStatus } from "@/lib/entry-status";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { AccountRepository } from "@/repositories/account-repository";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { ExpenseEntryRepository } from "@/repositories/expense-entry-repository";
import { TransactionCategoryRepository } from "@/repositories/transaction-category-repository";
import { PostingFailure, PostingService } from "@/services/posting-service";

const createSchema = z.object({
  payeeAccountId: z.string().min(1, "A payee account is required"),
  categoryId: z.string().min(1, "A category is required"),
  description: z.string().trim().min(1, "Description is required").max(500),
  totalAmount: z.coerce.bigint().refine((v) => v > 0n, "Total must be positive"),
  entryDate: z.coerce.date(),
  paymentDueOn: z.coerce.date(),
});

export type CreateExpenseInput = z.infer<typeof createSchema>;

export interface ExpenseEntryWithStatus extends ExpenseEntry {
  status: EntryStatus;
}

function withStatus(entry: ExpenseEntry): ExpenseEntryWithStatus {
  return {
    ...entry,
    status: computeEntryStatus({
      confirmed: entry.state === "CONFIRMED",
      paymentDueOn: entry.paymentDueOn,
    }),
  };
}

/**
 * Expense business logic. Mirrors IncomeService - confirming an entry
 * recognises the expense on the ledger (DR Expense, CR payee account) and
 * marks the entry CONFIRMED, atomically.
 */
export class ExpenseService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listEntries(): Promise<ExpenseEntryWithStatus[]> {
    const entries = await new ExpenseEntryRepository(this.db).listAll();
    return entries.map(withStatus);
  }

  /** Sum of amount_due across this payee account's CONFIRMED expense entries. */
  sumOutstandingForPayee(payeeAccountId: string): Promise<bigint> {
    return new ExpenseEntryRepository(this.db).sumOutstandingForPayee(
      payeeAccountId,
    );
  }

  /** Sigma total_amount on CONFIRMED expense entries with entry_date in [start, endExclusive). */
  sumTotalInPeriod(start: Date, endExclusive: Date): Promise<bigint> {
    return new ExpenseEntryRepository(this.db).sumTotalInPeriod(
      start,
      endExclusive,
    );
  }

  /** Sigma amount_due across all CONFIRMED expense entries (global payables). */
  sumOutstandingTotal(): Promise<bigint> {
    return new ExpenseEntryRepository(this.db).sumOutstandingTotal();
  }

  /** Monthly CONFIRMED-expense totals since `startInclusive`. See repo for shape. */
  monthlyTotalsSince(
    startInclusive: Date,
  ): Promise<{ month: Date; total: bigint }[]> {
    return new ExpenseEntryRepository(this.db).monthlyTotalsSince(
      startInclusive,
    );
  }

  async getEntry(id: string): Promise<Result<ExpenseEntryWithStatus>> {
    const entry = await new ExpenseEntryRepository(this.db).findById(id);
    return entry
      ? ok(withStatus(entry))
      : err(`Expense entry ${id} was not found`);
  }

  async createDraft(
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<ExpenseEntry>> {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const account = await new AccountRepository(this.db).findById(
      data.payeeAccountId,
    );
    if (!account) return err(`Account ${data.payeeAccountId} was not found`);
    const category = await new TransactionCategoryRepository(this.db).findById(
      data.categoryId,
    );
    if (!category) return err(`Category ${data.categoryId} was not found`);
    if (category.kind !== "EXPENSE") {
      return err("Category must be of kind EXPENSE");
    }

    const entry = await this.db.$transaction(async (tx) => {
      const created = await new ExpenseEntryRepository(tx).create({
        payeeAccountId: data.payeeAccountId,
        categoryId: data.categoryId,
        description: data.description,
        totalAmount: data.totalAmount,
        entryDate: data.entryDate,
        paymentDueOn: data.paymentDueOn,
      });
      await new AuditLogRepository(tx).record({
        action: "CREATE",
        entityType: "ExpenseEntry",
        entityId: created.id,
        summary: `Draft expense "${created.description}" created (${created.totalAmount.toString()})`,
        after: {
          id: created.id,
          payeeAccountId: created.payeeAccountId,
          categoryId: created.categoryId,
          totalAmount: created.totalAmount.toString(),
        },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return created;
    });

    return ok(entry);
  }

  async confirm(
    id: string,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<ExpenseEntry>> {
    const entry = await new ExpenseEntryRepository(this.db).findById(id);
    if (!entry) return err(`Expense entry ${id} was not found`);
    if (entry.state !== "DRAFT") {
      return err(
        `Expense entry ${id} cannot be confirmed (state: ${entry.state})`,
      );
    }

    const expense = await new AccountRepository(this.db).findBySystemKey(
      "EXPENSE",
    );
    if (!expense) {
      return err("Expense system account is missing - re-run the seed");
    }

    try {
      const confirmed = await this.db.$transaction(async (tx) => {
        await new PostingService().post(tx, {
          entryType: "EXPENSE",
          sourceType: "EXPENSE_ENTRY",
          sourceId: entry.id,
          effectiveDate: entry.entryDate,
          description: `Expense incurred: ${entry.description}`,
          postings: [
            {
              debitAccountId: expense.id,
              creditAccountId: entry.payeeAccountId,
              amount: entry.totalAmount,
            },
          ],
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        const updated = await new ExpenseEntryRepository(tx).markConfirmed(
          entry.id,
        );
        await new AuditLogRepository(tx).record({
          action: "CONFIRM",
          entityType: "ExpenseEntry",
          entityId: updated.id,
          summary: `Expense "${updated.description}" confirmed`,
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
