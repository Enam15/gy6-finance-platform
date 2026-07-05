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
});

export type CreateExpenseInput = z.infer<typeof createSchema>;

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
