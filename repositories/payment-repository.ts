import type { Payment } from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

/**
 * Fields accepted when creating a payment. Exactly one of incomeEntryId or
 * expenseEntryId must be set; a DB CHECK constraint enforces this.
 */
export interface CreatePaymentData {
  incomeEntryId?: string | null;
  expenseEntryId?: string | null;
  businessAccountId: string;
  amount: bigint;
  paidOn: Date;
  description?: string | null;
  createdBy?: string | null;
}

/** Data access for payments (instalments against confirmed income or expense entries). */
export class PaymentRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<Payment | null> {
    return this.db.payment.findUnique({ where: { id } });
  }

  listByIncomeEntry(incomeEntryId: string): Promise<Payment[]> {
    return this.db.payment.findMany({
      where: { incomeEntryId },
      orderBy: { paidOn: "asc" },
    });
  }

  listByExpenseEntry(expenseEntryId: string): Promise<Payment[]> {
    return this.db.payment.findMany({
      where: { expenseEntryId },
      orderBy: { paidOn: "asc" },
    });
  }

  create(data: CreatePaymentData): Promise<Payment> {
    return this.db.payment.create({
      data: {
        incomeEntryId: data.incomeEntryId ?? null,
        expenseEntryId: data.expenseEntryId ?? null,
        businessAccountId: data.businessAccountId,
        amount: data.amount,
        paidOn: data.paidOn,
        description: data.description ?? null,
        createdBy: data.createdBy ?? null,
      },
    });
  }
}
