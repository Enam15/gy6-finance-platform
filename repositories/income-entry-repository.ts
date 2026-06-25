import type {
  EntryState,
  FeeMethod,
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
  /** Set when this entry was generated from a renewal template. */
  renewalTemplateId?: string | null;
  /** Optional transaction fee, realised as a real cost at settlement. */
  feeMethod?: FeeMethod | null;
  feeLabel?: string | null;
  feeBps?: number | null;
  feeAmount?: bigint | null;
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

  /** Lean (id, categoryId) projection for a bounded set of ids. */
  categoryRefsByIds(
    ids: string[],
  ): Promise<{ id: string; categoryId: string }[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.incomeEntry.findMany({
      where: { id: { in: ids } },
      select: { id: true, categoryId: true },
    });
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
        renewalTemplateId: data.renewalTemplateId ?? null,
        feeMethod: data.feeMethod ?? null,
        feeLabel: data.feeLabel ?? null,
        feeBps: data.feeBps ?? null,
        feeAmount: data.feeAmount ?? null,
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

  /**
   * Sum of `total_amount` across CONFIRMED income entries with `entry_date`
   * in [start, endExclusive). Used for period KPIs on the dashboard.
   */
  async sumTotalInPeriod(start: Date, endExclusive: Date): Promise<bigint> {
    const result = await this.db.incomeEntry.aggregate({
      where: {
        state: "CONFIRMED",
        entryDate: { gte: start, lt: endExclusive },
      },
      _sum: { totalAmount: true },
    });
    return result._sum.totalAmount ?? 0n;
  }

  /**
   * Sum of `amount_due` across all CONFIRMED income entries (global
   * outstanding receivables for the dashboard).
   */
  async sumOutstandingTotal(): Promise<bigint> {
    const result = await this.db.incomeEntry.aggregate({
      where: { state: "CONFIRMED" },
      _sum: { amountDue: true },
    });
    return result._sum.amountDue ?? 0n;
  }

  /**
   * Group CONFIRMED income totals by month for the chart. Returns one row
   * per month that has at least one entry on or after `startInclusive`,
   * oldest first. Months with no data are not returned - the service layer
   * pads them with 0n.
   *
   * Raw SQL because Prisma's groupBy doesn't natively bucket by month.
   * entry_date is @db.Date so date_trunc returns a date when cast.
   */
  async monthlyTotalsSince(
    startInclusive: Date,
  ): Promise<{ month: Date; total: bigint }[]> {
    const rows = await this.db.$queryRaw<
      Array<{ month: Date; total: bigint | null }>
    >`
      SELECT date_trunc('month', entry_date)::date AS month,
             SUM(total_amount)::bigint            AS total
      FROM income_entries
      WHERE state = 'CONFIRMED'
        AND entry_date >= ${startInclusive}::date
      GROUP BY date_trunc('month', entry_date)
      ORDER BY month ASC
    `;
    return rows.map((r) => ({ month: r.month, total: r.total ?? 0n }));
  }
}
