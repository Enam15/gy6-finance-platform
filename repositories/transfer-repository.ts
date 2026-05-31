import type { Transfer } from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

export interface CreateTransferData {
  fromAccountId: string;
  toAccountId: string;
  amount: bigint;
  description?: string | null;
  effectiveDate: Date;
  createdBy?: string | null;
}

/**
 * Data access for transfers between Business accounts. Transfers are
 * created in the CONFIRMED state in a single step (the schema retains a
 * DRAFT state for future workflows but the service does not use it yet).
 */
export class TransferRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<Transfer | null> {
    return this.db.transfer.findUnique({ where: { id } });
  }

  listAll(): Promise<Transfer[]> {
    return this.db.transfer.findMany({ orderBy: { effectiveDate: "desc" } });
  }

  create(data: CreateTransferData): Promise<Transfer> {
    return this.db.transfer.create({
      data: {
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        description: data.description ?? null,
        effectiveDate: data.effectiveDate,
        state: "CONFIRMED",
        confirmedAt: new Date(),
        createdBy: data.createdBy ?? null,
      },
    });
  }
}
