import type {
  EntryState,
  IncomeEntry,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

export interface CreateIncomeEntryData {
  clientAccountId: string;
  categoryId: string;
  description: string;
  totalAmount: bigint;
  entryDate: Date;
  paymentDueOn: Date;
  createdBy?: string | null;
}

/**
 * Data access for income entries (the operational layer; the ledger postings
 * land in statement_entries).
 */
export class IncomeEntryRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<IncomeEntry | null> {
    return this.db.incomeEntry.findUnique({ where: { id } });
  }

  listAll(): Promise<IncomeEntry[]> {
    return this.db.incomeEntry.findMany({ orderBy: { createdAt: "desc" } });
  }

  listByState(state: EntryState): Promise<IncomeEntry[]> {
    return this.db.incomeEntry.findMany({
      where: { state },
      orderBy: { createdAt: "desc" },
    });
  }

  create(data: CreateIncomeEntryData): Promise<IncomeEntry> {
    return this.db.incomeEntry.create({
      data: {
        clientAccountId: data.clientAccountId,
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

  /** Mark a DRAFT entry as CONFIRMED. Caller must be inside a transaction. */
  markConfirmed(id: string): Promise<IncomeEntry> {
    return this.db.incomeEntry.update({
      where: { id },
      data: {
        state: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
  }

  /**
   * Sum of `amount_due` across CONFIRMED income entries with this client.
   * DRAFT and REVERSED entries are excluded - REVERSED already zeroed
   * via the posting that ran amount_due back down.
   */
  async sumOutstandingForClient(clientAccountId: string): Promise<bigint> {
    const result = await this.db.incomeEntry.aggregate({
      where: { clientAccountId, state: "CONFIRMED" },
      _sum: { amountDue: true },
    });
    return result._sum.amountDue ?? 0n;
  }
}
