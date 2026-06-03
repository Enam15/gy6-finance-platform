import type { PrismaClient } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  monthKey,
  monthRangesBack,
  quarterEndExclusive,
  quarterStart,
  yearEndExclusive,
  yearStart,
} from "@/lib/dates";
import { AccountService } from "@/services/account-service";
import { ExpenseService } from "@/services/expense-service";
import { IncomeService } from "@/services/income-service";

/** Income / expense / net for a single accounting period. */
export interface PeriodTotals {
  income: bigint;
  expense: bigint;
  /** income - expense, signed. */
  net: bigint;
}

/** One bucket on the monthly bar chart. */
export interface MonthlyPoint {
  /** First day of the month, midnight UTC. */
  monthStart: Date;
  income: bigint;
  expense: bigint;
}

export interface DashboardKpis {
  /** Sigma balance across active Business-category accounts. Real cash. */
  cashOnHand: bigint;
  /** Sigma amount_due across CONFIRMED income entries. What clients owe. */
  outstandingReceivables: bigint;
  /** Sigma amount_due across CONFIRMED expense entries. What GY6 owes. */
  outstandingPayables: bigint;
  /** Current calendar quarter (Q1=Jan-Mar, etc.) income / expense / net. */
  thisQuarter: PeriodTotals;
  /** Calendar year-to-date income / expense / net. */
  yearToDate: PeriodTotals;
  /** Rolling 12 months, oldest first; months with no data are 0n. */
  monthly: MonthlyPoint[];
}

const MONTHS_BACK = 12;

/**
 * Read-side orchestrator for the dashboard page. `getKpis()` fires the
 * underlying aggregate queries in parallel and assembles the result.
 *
 * Period totals are computed over `entry_date` (when the income/expense
 * was incurred), not `confirmed_at` - the accounting-standard convention.
 * State filter is CONFIRMED throughout: DRAFT entries don't recognise on
 * the ledger yet, and REVERSED entries already had their effect unwound
 * by the reversal flow.
 */
export class DashboardService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async getKpis(at: Date = new Date()): Promise<DashboardKpis> {
    const qStart = quarterStart(at);
    const qEnd = quarterEndExclusive(at);
    const yStart = yearStart(at);
    const yEnd = yearEndExclusive(at);

    const months = monthRangesBack(MONTHS_BACK, at);
    const monthlyStart = months[0] ?? qStart;

    const accountService = new AccountService(this.db);
    const incomeService = new IncomeService(this.db);
    const expenseService = new ExpenseService(this.db);

    const [
      cashOnHand,
      outstandingReceivables,
      outstandingPayables,
      qIncome,
      qExpense,
      yIncome,
      yExpense,
      monthlyIncomeRows,
      monthlyExpenseRows,
    ] = await Promise.all([
      accountService.sumCashOnHand(),
      incomeService.sumOutstandingTotal(),
      expenseService.sumOutstandingTotal(),
      incomeService.sumTotalInPeriod(qStart, qEnd),
      expenseService.sumTotalInPeriod(qStart, qEnd),
      incomeService.sumTotalInPeriod(yStart, yEnd),
      expenseService.sumTotalInPeriod(yStart, yEnd),
      incomeService.monthlyTotalsSince(monthlyStart),
      expenseService.monthlyTotalsSince(monthlyStart),
    ]);

    // Bucket the aggregate rows by YYYY-MM key, then pad the missing months
    // with 0n so the chart always gets exactly MONTHS_BACK points.
    const incomeByMonth = new Map<string, bigint>();
    for (const row of monthlyIncomeRows) {
      incomeByMonth.set(monthKey(row.month), row.total);
    }
    const expenseByMonth = new Map<string, bigint>();
    for (const row of monthlyExpenseRows) {
      expenseByMonth.set(monthKey(row.month), row.total);
    }
    const monthly: MonthlyPoint[] = months.map((m) => {
      const key = monthKey(m);
      return {
        monthStart: m,
        income: incomeByMonth.get(key) ?? 0n,
        expense: expenseByMonth.get(key) ?? 0n,
      };
    });

    return {
      cashOnHand,
      outstandingReceivables,
      outstandingPayables,
      thisQuarter: {
        income: qIncome,
        expense: qExpense,
        net: qIncome - qExpense,
      },
      yearToDate: {
        income: yIncome,
        expense: yExpense,
        net: yIncome - yExpense,
      },
      monthly,
    };
  }
}
