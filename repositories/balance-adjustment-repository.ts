import type { BalanceAdjustment } from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

export interface CreateBalanceAdjustmentData {
  accountId: string;
  previousBalance: bigint;
  newBalance: bigint;
  difference: bigint;
  reason: string;
  effectiveDate: Date;
  createdBy?: string | null;
}

/**
 * Data access for manual balance corrections. The DB CHECK constraint
 * `balance_adjustments_difference_formula` enforces that
 * difference = new_balance - previous_balance on every row.
 */
export class BalanceAdjustmentRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<BalanceAdjustment | null> {
    return this.db.balanceAdjustment.findUnique({ where: { id } });
  }

  listAll(): Promise<BalanceAdjustment[]> {
    return this.db.balanceAdjustment.findMany({
      orderBy: { effectiveDate: "desc" },
    });
  }

  listForAccount(accountId: string): Promise<BalanceAdjustment[]> {
    return this.db.balanceAdjustment.findMany({
      where: { accountId },
      orderBy: { effectiveDate: "desc" },
    });
  }

  create(data: CreateBalanceAdjustmentData): Promise<BalanceAdjustment> {
    return this.db.balanceAdjustment.create({
      data: {
        accountId: data.accountId,
        previousBalance: data.previousBalance,
        newBalance: data.newBalance,
        difference: data.difference,
        reason: data.reason,
        effectiveDate: data.effectiveDate,
        createdBy: data.createdBy ?? null,
      },
    });
  }
}
