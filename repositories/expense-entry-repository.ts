import type {
  EntryState,
  ExpenseEntry,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

export interface CreateExpenseEntryData {
  payeeAccountId: string;
  categoryId: string;
  description: string;
  totalAmount: bigint;
  entryDate: Date;
  paymentDueOn: Date;
  createdBy?: string | null;
}

/**
 * Data access for expense entries. Mirrors IncomeEntryRepository - kept
 * separate per Rule 1 (income and expense never share storage).
 */
export class ExpenseEntryRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<ExpenseEntry | null> {
    return this.db.expenseEntry.findUnique({ where: { id } });
  }

  listAll(): Promise<ExpenseEntry[]> {
    return this.db.expenseEntry.findMany({ orderBy: { createdAt: "desc" } });
  }

  listByState(state: EntryState): Promise<ExpenseEntry[]> {
    return this.db.expenseEntry.findMany({
      where: { state },
      orderBy: { createdAt: "desc" },
    });
  }

  create(data: CreateExpenseEntryData): Promise<ExpenseEntry> {
    return this.db.expenseEntry.create({
      data: {
        payeeAccountId: data.payeeAccountId,
        categoryId: data.categoryId,
        description: data.description,
        totalAmount: data.totalAmount,
        amountPaid: 0n,
        amountDue: data.totalAmount,
        entryDate: data.entryDate,
        paymentDueOn: data.paymentDueOn,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  markConfirmed(id: string): Promise<ExpenseEntry> {
    return this.db.expenseEntry.update({
      where: { id },
      data: {
        state: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
  }
}
