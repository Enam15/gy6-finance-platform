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
  /** Set when this entry was generated from a renewal template. */
  renewalTemplateId?: string | null;
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
        renewalTemplateId: data.renewalTemplateId ?? null,
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

  /**
   * Sum of `amount_due` across CONFIRMED expense entries with this payee.
   * DRAFT and REVERSED entries are excluded.
   */
  async sumOutstandingForPayee(payeeAccountId: string): Promise<bigint> {
    const result = await this.db.expenseEntry.aggregate({
      where: { payeeAccountId, state: "CONFIRMED" },
      _sum: { amountDue: true },
    });
    return result._sum.amountDue ?? 0n;
  }

  /**
   * Sum of `total_amount` across CONFIRMED expense entries with `entry_date`
   * in [start, endExclusive). Used for period KPIs on the dashboard.
   */
  async sumTotalInPeriod(start: Date, endExclusive: Date): Promise<bigint> {
    const result = await this.db.expenseEntry.aggregate({
      where: {
        state: "CONFIRMED",
        entryDate: { gte: start, lt: endExclusive },
      },
      _sum: { totalAmount: true },
    });
    return result._sum.totalAmount ?? 0n;
  }

  /**
   * Sum of `amount_due` across all CONFIRMED expense entries (global
   * outstanding payables for the dashboard).
   */
  async sumOutstandingTotal(): Promise<bigint> {
    const result = await this.db.expenseEntry.aggregate({
      where: { state: "CONFIRMED" },
      _sum: { amountDue: true },
    });
    return result._sum.amountDue ?? 0n;
  }

  /**
   * Group CONFIRMED expense totals by month for the chart. Mirror of the
   * income variant; see that for the rationale on raw SQL.
   */
  async monthlyTotalsSince(
    startInclusive: Date,
  ): Promise<{ month: Date; total: bigint }[]> {
    const rows = await this.db.$queryRaw<
      Array<{ month: Date; total: bigint | null }>
    >`
      SELECT date_trunc('month', entry_date)::date AS month,
             SUM(total_amount)::bigint            AS total
      FROM expense_entries
      WHERE state = 'CONFIRMED'
        AND entry_date >= ${startInclusive}::date
      GROUP BY date_trunc('month', entry_date)
      ORDER BY month ASC
    `;
    return rows.map((r) => ({ month: r.month, total: r.total ?? 0n }));
  }
}
