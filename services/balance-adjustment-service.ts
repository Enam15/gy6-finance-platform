import { z } from "zod";
import type {
  BalanceAdjustment,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { AccountRepository } from "@/repositories/account-repository";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { BalanceAdjustmentRepository } from "@/repositories/balance-adjustment-repository";
import { PostingFailure, PostingService } from "@/services/posting-service";

const createAdjustmentSchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
  newBalance: z.coerce.bigint(),
  reason: z.string().trim().min(1, "Reason is required").max(500),
  effectiveDate: z.coerce.date().optional(),
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

interface ActorOptions {
  actorId?: string | null;
  actorLabel?: string | null;
}

/**
 * Manual balance corrections.
 *
 * The service never mutates a balance directly: it computes the difference
 * and posts it through the ledger engine against the Adjustments system
 * account, with a BalanceAdjustment row capturing the before/after and the
 * reason. The posting direction is chosen so the target account moves from
 * previous to new regardless of its normal balance.
 *
 * The target account is locked and re-read inside the transaction so the
 * recorded `previousBalance` is accurate even under concurrent posting.
 */
export class BalanceAdjustmentService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listAll(): Promise<BalanceAdjustment[]> {
    return new BalanceAdjustmentRepository(this.db).listAll();
  }

  listForAccount(accountId: string): Promise<BalanceAdjustment[]> {
    return new BalanceAdjustmentRepository(this.db).listForAccount(accountId);
  }

  async createAdjustment(
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<BalanceAdjustment>> {
    const parsed = createAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;
    const effectiveDate = data.effectiveDate ?? new Date();

    const adjustments = await new AccountRepository(this.db).findBySystemKey(
      "ADJUSTMENTS",
    );
    if (!adjustments) {
      return err("Adjustments system account is missing - re-run the seed");
    }

    try {
      const adjustment = await this.db.$transaction(async (tx) => {
        // Lock and re-read the target account so previousBalance is accurate
        // even under concurrent posting.
        await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${data.accountId} FOR UPDATE`;
        const current = await tx.account.findUnique({
          where: { id: data.accountId },
        });
        if (!current) {
          throw new AdjustmentFailure(`Account ${data.accountId} was not found`);
        }

        const previousBalance = current.balance;
        const difference = data.newBalance - previousBalance;
        if (difference === 0n) {
          throw new AdjustmentFailure(
            `Account "${current.name}" already has balance ${previousBalance}; no adjustment needed`,
          );
        }

        // Pick the posting direction so the target account moves the right
        // way regardless of its normal balance:
        //   debit-normal account going up   -> DR account, CR Adjustments
        //   debit-normal account going down -> DR Adjustments, CR account
        //   credit-normal going up          -> DR Adjustments, CR account
        //   credit-normal going down        -> DR account, CR Adjustments
        const debitTargetAccount =
          (current.normalBalance === "DEBIT") === (difference > 0n);
        const amount = difference > 0n ? difference : -difference;

        const created = await new BalanceAdjustmentRepository(tx).create({
          accountId: current.id,
          previousBalance,
          newBalance: data.newBalance,
          difference,
          reason: data.reason,
          effectiveDate,
        });

        await new PostingService().post(tx, {
          entryType: "ADJUSTMENT",
          sourceType: "BALANCE_ADJUSTMENT",
          sourceId: created.id,
          effectiveDate,
          description: `Balance adjustment for "${current.name}": ${data.reason}`,
          postings: [
            {
              debitAccountId: debitTargetAccount ? current.id : adjustments.id,
              creditAccountId: debitTargetAccount ? adjustments.id : current.id,
              amount,
            },
          ],
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });

        await new AuditLogRepository(tx).record({
          action: "ADJUST",
          entityType: "BalanceAdjustment",
          entityId: created.id,
          summary: `Adjusted "${current.name}" from ${previousBalance.toString()} to ${data.newBalance.toString()}: ${data.reason}`,
          after: {
            id: created.id,
            accountId: current.id,
            previousBalance: previousBalance.toString(),
            newBalance: data.newBalance.toString(),
            difference: difference.toString(),
            reason: data.reason,
          },
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });

        return created;
      });
      return ok(adjustment);
    } catch (error) {
      if (error instanceof AdjustmentFailure) return err(error.message);
      if (error instanceof PostingFailure) return err(error.message);
      throw error;
    }
  }
}

class AdjustmentFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdjustmentFailure";
  }
}
