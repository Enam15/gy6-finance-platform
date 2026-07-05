import { z } from "zod";
import type {
  PrismaClient,
  Transfer,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { computeFeeMinor, feeLineDescription } from "@/lib/fees";
import { AccountRepository } from "@/repositories/account-repository";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { TransferRepository } from "@/repositories/transfer-repository";
import {
  PostingFailure,
  PostingService,
  type PostingLine,
} from "@/services/posting-service";

const createTransferSchema = z.object({
  fromAccountId: z.string().min(1, "fromAccountId is required"),
  toAccountId: z.string().min(1, "toAccountId is required"),
  amount: z.coerce.bigint().refine((v) => v > 0n, "Amount must be positive"),
  effectiveDate: z.coerce.date(),
  description: z.string().trim().max(500).optional(),
  feeMethod: z.enum(["BANK", "UPWORK", "ONLINE_WALLET"]).nullish(),
  feeLabel: z.string().trim().max(120).nullish(),
  feeBps: z.coerce.number().int().min(0).max(10000).nullish(),
  feeAmount: z.coerce
    .bigint()
    .refine((v) => v >= 0n, "Fee amount cannot be negative")
    .nullish(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

/**
 * Normalise the optional fee inputs into the columns stored on a transfer.
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

interface ActorOptions {
  actorId?: string | null;
  actorLabel?: string | null;
}

/**
 * Transfers between two of GY6's own (Business-category) accounts.
 *
 * A transfer is created in CONFIRMED state and posted atomically:
 * DR `to` / CR `from` for the transfer amount. The posting engine's
 * negative-balance guard catches insufficient funds on the source account
 * unless that account has allowNegative.
 */
export class TransferService {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string): Promise<Transfer | null> {
    return new TransferRepository(this.db).findById(id);
  }

  listAll(): Promise<Transfer[]> {
    return new TransferRepository(this.db).listAll();
  }

  async createTransfer(
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<Transfer>> {
    const parsed = createTransferSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    if (data.fromAccountId === data.toAccountId) {
      return err("Transfer source and destination must be different accounts");
    }

    // Both accounts must be in the BUSINESS category.
    const accounts = await this.db.account.findMany({
      where: { id: { in: [data.fromAccountId, data.toAccountId] } },
      include: { category: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const from = accountMap.get(data.fromAccountId);
    const to = accountMap.get(data.toAccountId);
    if (!from) return err(`From account ${data.fromAccountId} was not found`);
    if (!to) return err(`To account ${data.toAccountId} was not found`);
    if (from.category.key !== "BUSINESS") {
      return err(
        `From account "${from.name}" is in category ${from.category.key}; transfers require Business accounts`,
      );
    }
    if (to.category.key !== "BUSINESS") {
      return err(
        `To account "${to.name}" is in category ${to.category.key}; transfers require Business accounts`,
      );
    }

    try {
      const fee = resolveFee(
        data.amount,
        data.feeMethod,
        data.feeLabel,
        data.feeBps,
        data.feeAmount,
      );
      const transferDescription =
        data.description ?? `Transfer from "${from.name}" to "${to.name}"`;

      const transfer = await this.db.$transaction(async (tx) => {
        const created = await new TransferRepository(tx).create({
          fromAccountId: data.fromAccountId,
          toAccountId: data.toAccountId,
          amount: data.amount,
          description: data.description ?? null,
          effectiveDate: data.effectiveDate,
          feeMethod: fee.feeMethod,
          feeLabel: fee.feeLabel,
          feeBps: fee.feeBps,
          feeAmount: fee.feeAmount,
        });

        // With a fee, the destination receives amount − fee; the source loses
        // the full amount and the fee is recorded as a real cost.
        const feeApplied = fee.feeAmount ?? 0n;
        const transferPostings: PostingLine[] = [];
        const netToDest = data.amount - feeApplied;
        if (netToDest > 0n) {
          transferPostings.push({
            debitAccountId: data.toAccountId,
            creditAccountId: data.fromAccountId,
            amount: netToDest,
          });
        }
        if (feeApplied > 0n) {
          const feeAccount = await new AccountRepository(
            tx,
          ).findOrCreateTransactionFeesAccount();
          transferPostings.push({
            debitAccountId: feeAccount.id,
            creditAccountId: data.fromAccountId,
            amount: feeApplied,
            description: feeLineDescription(
              fee.feeMethod,
              fee.feeLabel,
              transferDescription,
            ),
          });
        }
        await new PostingService().post(tx, {
          entryType: "TRANSFER",
          sourceType: "TRANSFER",
          sourceId: created.id,
          effectiveDate: data.effectiveDate,
          description: transferDescription,
          postings: transferPostings,
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        await new AuditLogRepository(tx).record({
          action: "TRANSFER",
          entityType: "Transfer",
          entityId: created.id,
          summary: `Transfer of ${data.amount.toString()} from "${from.name}" to "${to.name}"`,
          after: {
            id: created.id,
            fromAccountId: data.fromAccountId,
            toAccountId: data.toAccountId,
            amount: data.amount.toString(),
            effectiveDate: data.effectiveDate.toISOString(),
          },
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        return created;
      });
      return ok(transfer);
    } catch (error) {
      if (error instanceof PostingFailure) return err(error.message);
      throw error;
    }
  }
}
