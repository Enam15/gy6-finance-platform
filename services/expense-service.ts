import { z } from "zod";
import type {
  ExpenseEntry,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { computeEntryStatus, type EntryStatus } from "@/lib/entry-status";
import { computeFeeMinor } from "@/lib/fees";
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
  feeMethod: z.enum(["BANK", "UPWORK", "ONLINE_WALLET"]).nullish(),
  feeLabel: z.string().trim().max(120).nullish(),
  feeBps: z.coerce.number().int().min(0).max(10000).nullish(),
  feeAmount: z.coerce
    .bigint()
    .refine((v) => v >= 0n, "Fee amount cannot be negative")
    .nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export type CreateExpenseInput = z.infer<typeof createSchema>;

/**
 * The only changes a posted entry accepts: how it is filed, labelled,
 * scheduled and annotated. Strict on purpose - a body that also carries an
 * amount, account, date or fee is rejected rather than quietly stripped, so
 * nobody can believe a locked field was saved when it wasn't.
 */
const postedPatchSchema = z.strictObject({
  categoryId: z.string().min(1, "A category is required"),
  description: z.string().trim().min(1, "Description is required").max(500),
  paymentDueOn: z.coerce.date(),
  notes: z.string().trim().max(2000).nullish(),
});

/**
 * Normalise the optional fee inputs into the columns stored on an entry.
 * A fee is either a percentage (feeBps) or a fixed amount (feeAmount); the
 * percentage takes precedence when both are somehow present.
 */
function resolveFee(
  totalAmount: bigint,
  feeMethod: "BANK" | "UPWORK" | "ONLINE_WALLET" | null | undefined,
  feeLabel: string | null | undefined,
  feeBps: number | null | undefined,
  feeAmount: bigint | null | undefined,
) {
  const label = feeLabel && feeLabel.length > 0 ? feeLabel : null;
  const bps = feeBps ?? 0;
  if (feeMethod && bps > 0) {
    return {
      feeMethod,
      feeLabel: label,
      feeBps: bps,
      feeAmount: computeFeeMinor(totalAmount, bps),
    };
  }
  // Fixed-amount fee (no percentage): cap at the total so the net can never
  // go negative, matching the percentage path's cap.
  const fixed = feeAmount ?? 0n;
  if (feeMethod && fixed > 0n) {
    const capped = fixed > totalAmount ? totalAmount : fixed;
    return { feeMethod, feeLabel: label, feeBps: null, feeAmount: capped };
  }
  return { feeMethod: null, feeLabel: null, feeBps: null, feeAmount: null };
}

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

  /** (id, categoryId) for a bounded set of entry ids - used by the ledger. */
  categoryRefsByIds(
    ids: string[],
  ): Promise<{ id: string; categoryId: string }[]> {
    return new ExpenseEntryRepository(this.db).categoryRefsByIds(ids);
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

    const fee = resolveFee(
      data.totalAmount,
      data.feeMethod,
      data.feeLabel,
      data.feeBps,
      data.feeAmount,
    );

    const entry = await this.db.$transaction(async (tx) => {
      const created = await new ExpenseEntryRepository(tx).create({
        payeeAccountId: data.payeeAccountId,
        categoryId: data.categoryId,
        description: data.description,
        totalAmount: data.totalAmount,
        entryDate: data.entryDate,
        paymentDueOn: data.paymentDueOn,
        feeMethod: fee.feeMethod,
        feeLabel: fee.feeLabel,
        feeBps: fee.feeBps,
        feeAmount: fee.feeAmount,
        notes: data.notes ?? null,
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

  /**
   * Edit an expense entry. What that means depends on its state: a DRAFT has
   * not touched the ledger and is fully editable; a CONFIRMED entry has, so
   * it only accepts changes no posting is built from (see lib/entry-edit);
   * a REVERSED one is closed to edits entirely.
   */
  async update(
    id: string,
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<ExpenseEntry>> {
    const existing = await new ExpenseEntryRepository(this.db).findById(id);
    if (!existing) return err(`Expense entry ${id} was not found`);

    switch (existing.state) {
      case "DRAFT":
        return this.updateDraftEntry(existing, input, options);
      case "CONFIRMED":
        return this.updatePostedEntry(existing, input, options);
      case "REVERSED":
        return err(
          "This expense entry has been reversed and can no longer be edited",
        );
    }
  }

  /** Resolve a category id, rejecting one that is not an expense category. */
  private async requireExpenseCategory(id: string): Promise<Result<true>> {
    const category = await new TransactionCategoryRepository(this.db).findById(
      id,
    );
    if (!category) return err(`Category ${id} was not found`);
    if (category.kind !== "EXPENSE") {
      return err("Category must be of kind EXPENSE");
    }
    return ok(true);
  }

  /**
   * Full edit of a not-yet-posted entry. Nothing is on the books, so every
   * field is fair game - re-validated exactly like creation.
   */
  private async updateDraftEntry(
    existing: ExpenseEntry,
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null },
  ): Promise<Result<ExpenseEntry>> {
    const id = existing.id;
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const account = await new AccountRepository(this.db).findById(
      data.payeeAccountId,
    );
    if (!account) return err(`Account ${data.payeeAccountId} was not found`);
    const category = await this.requireExpenseCategory(data.categoryId);
    if (!category.ok) return err(category.error);

    const fee = resolveFee(
      data.totalAmount,
      data.feeMethod,
      data.feeLabel,
      data.feeBps,
      data.feeAmount,
    );

    const entry = await this.db.$transaction(async (tx) => {
      const updated = await new ExpenseEntryRepository(tx).updateDraft(id, {
        payeeAccountId: data.payeeAccountId,
        categoryId: data.categoryId,
        description: data.description,
        totalAmount: data.totalAmount,
        entryDate: data.entryDate,
        paymentDueOn: data.paymentDueOn,
        feeMethod: fee.feeMethod,
        feeLabel: fee.feeLabel,
        feeBps: fee.feeBps,
        feeAmount: fee.feeAmount,
        notes: data.notes ?? null,
      });
      await new AuditLogRepository(tx).record({
        action: "UPDATE",
        entityType: "ExpenseEntry",
        entityId: updated.id,
        summary: `Draft expense "${updated.description}" edited`,
        before: {
          description: existing.description,
          totalAmount: existing.totalAmount.toString(),
          payeeAccountId: existing.payeeAccountId,
          categoryId: existing.categoryId,
        },
        after: {
          description: updated.description,
          totalAmount: updated.totalAmount.toString(),
          payeeAccountId: updated.payeeAccountId,
          categoryId: updated.categoryId,
        },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return updated;
    });

    return ok(entry);
  }

  /**
   * Edit of a posted entry, restricted to the fields no posting is built
   * from. The schema is strict, so a caller that tries to slip in a new
   * amount, account, date or fee gets a loud error rather than a silently
   * dropped change - those are corrected by reversing the entry.
   */
  private async updatePostedEntry(
    existing: ExpenseEntry,
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null },
  ): Promise<Result<ExpenseEntry>> {
    const parsed = postedPatchSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const category = await this.requireExpenseCategory(data.categoryId);
    if (!category.ok) return err(category.error);

    const entry = await this.db.$transaction(async (tx) => {
      const updated = await new ExpenseEntryRepository(tx).updatePostedFields(
        existing.id,
        {
          categoryId: data.categoryId,
          description: data.description,
          paymentDueOn: data.paymentDueOn,
          notes: data.notes ?? null,
        },
      );
      await new AuditLogRepository(tx).record({
        action: "UPDATE",
        entityType: "ExpenseEntry",
        entityId: updated.id,
        summary: `Posted expense "${updated.description}" re-labelled - ledger untouched`,
        before: {
          description: existing.description,
          categoryId: existing.categoryId,
          paymentDueOn: existing.paymentDueOn.toISOString().slice(0, 10),
          notes: existing.notes,
        },
        after: {
          description: updated.description,
          categoryId: updated.categoryId,
          paymentDueOn: updated.paymentDueOn.toISOString().slice(0, 10),
          notes: updated.notes,
        },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return updated;
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
