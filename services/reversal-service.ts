import { z } from "zod";
import type {
  PrismaClient,
  StatementEntry,
  StatementSourceType,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import {
  PostingFailure,
  PostingService,
  type PostingLine,
} from "@/services/posting-service";

const reverseSchema = z.object({
  transactionGroupId: z.string().min(1, "transactionGroupId is required"),
  reason: z.string().trim().min(1, "Reason is required").max(500),
});

export type ReverseTransactionInput = z.infer<typeof reverseSchema>;

export interface ReversalResult {
  originalGroupId: string;
  reversalGroupId: string;
  entries: StatementEntry[];
}

interface ActorOptions {
  actorId?: string | null;
  actorLabel?: string | null;
}

/**
 * Reverse a posted transaction without mutating history. The original
 * statement_entries stay forever; a new group of mirrored entries (debit
 * and credit swapped, same amount, each linked via reversesEntryId) is
 * posted to cancel the effect on balances.
 *
 * For source records with state, the operational record is marked REVERSED
 * (income_entries, expense_entries, transfers). For payments, the parent
 * entry's amount_paid / amount_due is rolled back. Balance adjustments
 * leave only a ledger trace - the BalanceAdjustment record stays.
 */
export class ReversalService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async reverseTransaction(
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<ReversalResult>> {
    const parsed = reverseSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    try {
      const result = await this.db.$transaction(async (tx) => {
        const originals = await tx.statementEntry.findMany({
          where: { transactionGroupId: data.transactionGroupId },
          orderBy: { createdAt: "asc" },
        });
        if (originals.length === 0) {
          throw new ReversalFailure(
            `No statement entries found for group ${data.transactionGroupId}`,
          );
        }
        const first = originals[0];
        if (!first) {
          throw new ReversalFailure("Internal: empty group after length check");
        }
        if (first.entryType === "REVERSAL") {
          throw new ReversalFailure(
            "Cannot reverse a reversal; correct the original or post a fresh entry",
          );
        }

        // Reject if any of the originals has already been reversed.
        for (const o of originals) {
          const existing = await tx.statementEntry.findUnique({
            where: { reversesEntryId: o.id },
          });
          if (existing) {
            throw new ReversalFailure(
              `Entry ${o.id} has already been reversed by ${existing.id}`,
            );
          }
        }

        const sourceType = first.sourceType;
        const sourceId = first.sourceId;

        // Source-record cascade BEFORE the posting, so any conflict (e.g.
        // payments exist on the income entry) aborts cleanly.
        switch (sourceType) {
          case "INCOME_ENTRY": {
            const entry = await tx.incomeEntry.findUnique({
              where: { id: sourceId },
            });
            if (!entry) {
              throw new ReversalFailure(
                `Income entry ${sourceId} was not found`,
              );
            }
            if (entry.amountPaid > 0n) {
              throw new ReversalFailure(
                "Income entry has payments recorded; reverse the payments first",
              );
            }
            await tx.incomeEntry.update({
              where: { id: sourceId },
              data: { state: "REVERSED" },
            });
            break;
          }
          case "EXPENSE_ENTRY": {
            const entry = await tx.expenseEntry.findUnique({
              where: { id: sourceId },
            });
            if (!entry) {
              throw new ReversalFailure(
                `Expense entry ${sourceId} was not found`,
              );
            }
            if (entry.amountPaid > 0n) {
              throw new ReversalFailure(
                "Expense entry has payments recorded; reverse the payments first",
              );
            }
            await tx.expenseEntry.update({
              where: { id: sourceId },
              data: { state: "REVERSED" },
            });
            break;
          }
          case "TRANSFER": {
            const transfer = await tx.transfer.findUnique({
              where: { id: sourceId },
            });
            if (!transfer) {
              throw new ReversalFailure(`Transfer ${sourceId} was not found`);
            }
            await tx.transfer.update({
              where: { id: sourceId },
              data: { state: "REVERSED" },
            });
            break;
          }
          case "PAYMENT": {
            const payment = await tx.payment.findUnique({
              where: { id: sourceId },
            });
            if (!payment) {
              throw new ReversalFailure(`Payment ${sourceId} was not found`);
            }
            // Roll back amount_paid / amount_due on the parent entry.
            if (payment.incomeEntryId) {
              await tx.incomeEntry.update({
                where: { id: payment.incomeEntryId },
                data: {
                  amountPaid: { decrement: payment.amount },
                  amountDue: { increment: payment.amount },
                },
              });
            } else if (payment.expenseEntryId) {
              await tx.expenseEntry.update({
                where: { id: payment.expenseEntryId },
                data: {
                  amountPaid: { decrement: payment.amount },
                  amountDue: { increment: payment.amount },
                },
              });
            }
            break;
          }
          case "BALANCE_ADJUSTMENT": {
            // The BalanceAdjustment row stays as historical evidence; the
            // mirrored posting below restores the prior balance.
            break;
          }
          case "DISTRIBUTION": {
            // The Distribution + DistributionShare rows stay as historical
            // evidence; the mirrored postings move the cash back into the
            // Business source account.
            break;
          }
        }

        // Build mirrored postings.
        const reversalPostings: PostingLine[] = originals.map((o) => ({
          debitAccountId: o.creditAccountId,
          creditAccountId: o.debitAccountId,
          amount: o.amount,
          description: `Reversal: ${o.description}`,
          reversesEntryId: o.id,
        }));

        const postResult = await new PostingService().post(tx, {
          entryType: "REVERSAL",
          sourceType,
          sourceId,
          effectiveDate: new Date(),
          description: `Reversal of group ${data.transactionGroupId}: ${data.reason}`,
          postings: reversalPostings,
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });

        await new AuditLogRepository(tx).record({
          action: "REVERSE",
          entityType: "StatementEntryGroup",
          entityId: data.transactionGroupId,
          summary: `Reversed transaction group ${data.transactionGroupId} (${originals.length} entr${originals.length === 1 ? "y" : "ies"}): ${data.reason}`,
          before: {
            transactionGroupId: data.transactionGroupId,
            entries: originals.length,
            sourceType,
            sourceId,
          },
          after: {
            reversalGroupId: postResult.transactionGroupId,
            reason: data.reason,
          },
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });

        return {
          originalGroupId: data.transactionGroupId,
          reversalGroupId: postResult.transactionGroupId,
          entries: postResult.entries,
        };
      });
      return ok(result);
    } catch (error) {
      if (error instanceof ReversalFailure) return err(error.message);
      if (error instanceof PostingFailure) return err(error.message);
      throw error;
    }
  }

  /**
   * Reverse the transaction whose source is `(sourceType, sourceId)`. Looks
   * up the original statement-entry group (skipping any REVERSAL entries)
   * and delegates to reverseTransaction. Returns a 'not found' error if the
   * source has no postings yet (e.g. a DRAFT income entry that was never
   * confirmed).
   */
  async reverseSource(
    sourceType: StatementSourceType,
    sourceId: string,
    reason: string,
    options: ActorOptions = {},
  ): Promise<Result<ReversalResult>> {
    const entry = await this.db.statementEntry.findFirst({
      where: {
        sourceType,
        sourceId,
        entryType: { not: "REVERSAL" },
      },
    });
    if (!entry) {
      return err(
        `No statement entries found for ${sourceType.toLowerCase()} ${sourceId}`,
      );
    }
    return this.reverseTransaction(
      { transactionGroupId: entry.transactionGroupId, reason },
      options,
    );
  }
}

class ReversalFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReversalFailure";
  }
}
