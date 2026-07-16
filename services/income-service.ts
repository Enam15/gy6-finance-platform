import { z } from "zod";
import type {
  IncomeEntry,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { computeEntryStatus, type EntryStatus } from "@/lib/entry-status";
import { computeFeeMinor } from "@/lib/fees";
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
  feeMethod: z.enum(["BANK", "UPWORK", "ONLINE_WALLET"]).nullish(),
  feeLabel: z.string().trim().max(120).nullish(),
  feeBps: z.coerce.number().int().min(0).max(10000).nullish(),
  feeAmount: z.coerce
    .bigint()
    .refine((v) => v >= 0n, "Fee amount cannot be negative")
    .nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export type CreateIncomeInput = z.infer<typeof createSchema>;

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

  /** (id, categoryId) for a bounded set of entry ids - used by the ledger. */
  categoryRefsByIds(
    ids: string[],
  ): Promise<{ id: string; categoryId: string }[]> {
    return new IncomeEntryRepository(this.db).categoryRefsByIds(ids);
  }

  /** Sum of amount_due across this client account's CONFIRMED income entries. */
  sumOutstandingForClient(clientAccountId: string): Promise<bigint> {
    return new IncomeEntryRepository(this.db).sumOutstandingForClient(
      clientAccountId,
    );
  }

  /** Sigma total_amount on CONFIRMED income entries with entry_date in [start, endExclusive). */
  sumTotalInPeriod(start: Date, endExclusive: Date): Promise<bigint> {
    return new IncomeEntryRepository(this.db).sumTotalInPeriod(
      start,
      endExclusive,
    );
  }

  /** Sigma amount_due across all CONFIRMED income entries (global receivables). */
  sumOutstandingTotal(): Promise<bigint> {
    return new IncomeEntryRepository(this.db).sumOutstandingTotal();
  }

  /** Monthly CONFIRMED-income totals since `startInclusive`. See repo for shape. */
  monthlyTotalsSince(
    startInclusive: Date,
  ): Promise<{ month: Date; total: bigint }[]> {
    return new IncomeEntryRepository(this.db).monthlyTotalsSince(
      startInclusive,
    );
  }

  async getEntry(id: string): Promise<Result<IncomeEntryWithStatus>> {
    const entry = await new IncomeEntryRepository(this.db).findById(id);
    return entry
      ? ok(withStatus(entry))
      : err(`Income entry ${id} was not found`);
  }

  async createDraft(
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<IncomeEntry>> {
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

    const fee = resolveFee(
      data.totalAmount,
      data.feeMethod,
      data.feeLabel,
      data.feeBps,
      data.feeAmount,
    );

    const entry = await this.db.$transaction(async (tx) => {
      const created = await new IncomeEntryRepository(tx).create({
        clientAccountId: data.clientAccountId,
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
        entityType: "IncomeEntry",
        entityId: created.id,
        summary: `Draft income "${created.description}" created (${created.totalAmount.toString()})`,
        after: {
          id: created.id,
          clientAccountId: created.clientAccountId,
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
   * Edit an income entry. What that means depends on its state: a DRAFT has
   * not touched the ledger and is fully editable; a CONFIRMED entry has, so
   * it only accepts changes no posting is built from (see lib/entry-edit);
   * a REVERSED one is closed to edits entirely.
   */
  async update(
    id: string,
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null } = {},
  ): Promise<Result<IncomeEntry>> {
    const existing = await new IncomeEntryRepository(this.db).findById(id);
    if (!existing) return err(`Income entry ${id} was not found`);

    switch (existing.state) {
      case "DRAFT":
        return this.updateDraftEntry(existing, input, options);
      case "CONFIRMED":
        return this.updatePostedEntry(existing, input, options);
      case "REVERSED":
        return err(
          "This income entry has been reversed and can no longer be edited",
        );
    }
  }

  /** Resolve a category id, rejecting one that is not an income category. */
  private async requireIncomeCategory(id: string): Promise<Result<true>> {
    const category = await new TransactionCategoryRepository(this.db).findById(
      id,
    );
    if (!category) return err(`Category ${id} was not found`);
    if (category.kind !== "INCOME") {
      return err("Category must be of kind INCOME");
    }
    return ok(true);
  }

  /**
   * Full edit of a not-yet-posted entry. Nothing is on the books, so every
   * field is fair game - re-validated exactly like creation.
   */
  private async updateDraftEntry(
    existing: IncomeEntry,
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null },
  ): Promise<Result<IncomeEntry>> {
    const id = existing.id;
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const account = await new AccountRepository(this.db).findById(
      data.clientAccountId,
    );
    if (!account) return err(`Account ${data.clientAccountId} was not found`);
    const category = await this.requireIncomeCategory(data.categoryId);
    if (!category.ok) return err(category.error);

    const fee = resolveFee(
      data.totalAmount,
      data.feeMethod,
      data.feeLabel,
      data.feeBps,
      data.feeAmount,
    );

    const entry = await this.db.$transaction(async (tx) => {
      const updated = await new IncomeEntryRepository(tx).updateDraft(id, {
        clientAccountId: data.clientAccountId,
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
        entityType: "IncomeEntry",
        entityId: updated.id,
        summary: `Draft income "${updated.description}" edited`,
        before: {
          description: existing.description,
          totalAmount: existing.totalAmount.toString(),
          clientAccountId: existing.clientAccountId,
          categoryId: existing.categoryId,
        },
        after: {
          description: updated.description,
          totalAmount: updated.totalAmount.toString(),
          clientAccountId: updated.clientAccountId,
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
    existing: IncomeEntry,
    input: unknown,
    options: { actorId?: string | null; actorLabel?: string | null },
  ): Promise<Result<IncomeEntry>> {
    const parsed = postedPatchSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const category = await this.requireIncomeCategory(data.categoryId);
    if (!category.ok) return err(category.error);

    const entry = await this.db.$transaction(async (tx) => {
      const updated = await new IncomeEntryRepository(tx).updatePostedFields(
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
        entityType: "IncomeEntry",
        entityId: updated.id,
        summary: `Posted income "${updated.description}" re-labelled - ledger untouched`,
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
