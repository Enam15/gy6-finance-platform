import { z } from "zod";
import type {
  Payment,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { feeMethodLabel } from "@/lib/fees";
import { AccountRepository } from "@/repositories/account-repository";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { ExpenseEntryRepository } from "@/repositories/expense-entry-repository";
import { IncomeEntryRepository } from "@/repositories/income-entry-repository";
import { PaymentRepository } from "@/repositories/payment-repository";
import {
  PostingFailure,
  PostingService,
  type PostingLine,
} from "@/services/posting-service";

/** Human description for the fee posting line. */
function feeLineDescription(
  method: string | null,
  label: string | null,
  entryDescription: string,
): string {
  const channel = method ? feeMethodLabel(method) : "fee";
  const named = label ? `${channel} - ${label}` : channel;
  return `Transaction fee (${named}) on: ${entryDescription}`;
}

const recordIncomePaymentSchema = z.object({
  incomeEntryId: z.string().min(1, "incomeEntryId is required"),
  businessAccountId: z.string().min(1, "businessAccountId is required"),
  amount: z.coerce.bigint().refine((v) => v > 0n, "Amount must be positive"),
  paidOn: z.coerce.date(),
  description: z.string().trim().max(500).optional(),
});

const recordExpensePaymentSchema = z.object({
  expenseEntryId: z.string().min(1, "expenseEntryId is required"),
  businessAccountId: z.string().min(1, "businessAccountId is required"),
  amount: z.coerce.bigint().refine((v) => v > 0n, "Amount must be positive"),
  paidOn: z.coerce.date(),
  description: z.string().trim().max(500).optional(),
});

export type RecordIncomePaymentInput = z.infer<
  typeof recordIncomePaymentSchema
>;
export type RecordExpensePaymentInput = z.infer<
  typeof recordExpensePaymentSchema
>;

interface ActorOptions {
  actorId?: string | null;
  actorLabel?: string | null;
}

/**
 * Payments business logic. A payment records an instalment against a
 * confirmed income or expense entry; the same posting moment also moves
 * cash through the ledger and updates the entry's amount_paid / amount_due.
 * All three changes happen in one DB transaction.
 */
export class PaymentService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listForIncomeEntry(incomeEntryId: string): Promise<Payment[]> {
    return new PaymentRepository(this.db).listByIncomeEntry(incomeEntryId);
  }

  listForExpenseEntry(expenseEntryId: string): Promise<Payment[]> {
    return new PaymentRepository(this.db).listByExpenseEntry(expenseEntryId);
  }

  /**
   * Record a payment received from a client against a confirmed income
   * entry. Posts DR Business (cash in), CR Client (receivable down), and
   * increases amount_paid on the income entry.
   */
  async recordIncomePayment(
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<Payment>> {
    const parsed = recordIncomePaymentSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const entry = await new IncomeEntryRepository(this.db).findById(
      data.incomeEntryId,
    );
    if (!entry) return err(`Income entry ${data.incomeEntryId} was not found`);
    if (entry.state !== "CONFIRMED") {
      return err(
        `Cannot pay an unconfirmed income entry (state: ${entry.state})`,
      );
    }
    if (data.amount > entry.amountDue) {
      return err(
        `Payment of ${data.amount} exceeds the outstanding amount (${entry.amountDue})`,
      );
    }

    const businessCheck = await this.assertIsBusinessAccount(
      data.businessAccountId,
    );
    if (!businessCheck.ok) return err(businessCheck.error);

    try {
      const payment = await this.db.$transaction(async (tx) => {
        const created = await new PaymentRepository(tx).create({
          incomeEntryId: entry.id,
          businessAccountId: data.businessAccountId,
          amount: data.amount,
          paidOn: data.paidOn,
          description: data.description ?? null,
        });
        // A fee, if any, is realised when the payment settles the entry:
        // the client pays the gross, the business nets gross − fee, and the
        // fee is recorded as a real cost against Transaction Fees.
        const settles = data.amount === entry.amountDue;
        let feeApplied = 0n;
        if (settles && entry.feeAmount && entry.feeAmount > 0n) {
          feeApplied =
            entry.feeAmount > data.amount ? data.amount : entry.feeAmount;
        }
        const incomePostings: PostingLine[] = [];
        const netToBusiness = data.amount - feeApplied;
        if (netToBusiness > 0n) {
          incomePostings.push({
            debitAccountId: data.businessAccountId,
            creditAccountId: entry.clientAccountId,
            amount: netToBusiness,
          });
        }
        if (feeApplied > 0n) {
          const feeAccount = await new AccountRepository(
            tx,
          ).findOrCreateTransactionFeesAccount();
          incomePostings.push({
            debitAccountId: feeAccount.id,
            creditAccountId: entry.clientAccountId,
            amount: feeApplied,
            description: feeLineDescription(
              entry.feeMethod,
              entry.feeLabel,
              entry.description,
            ),
          });
        }
        await new PostingService().post(tx, {
          entryType: "PAYMENT",
          sourceType: "PAYMENT",
          sourceId: created.id,
          effectiveDate: data.paidOn,
          description: `Payment received for: ${entry.description}`,
          postings: incomePostings,
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        await tx.incomeEntry.update({
          where: { id: entry.id },
          data: {
            amountPaid: { increment: data.amount },
            amountDue: { decrement: data.amount },
          },
        });
        await new AuditLogRepository(tx).record({
          action: "CONFIRM",
          entityType: "Payment",
          entityId: created.id,
          summary: `Payment of ${data.amount.toString()} recorded for income "${entry.description}"`,
          after: {
            id: created.id,
            incomeEntryId: entry.id,
            businessAccountId: data.businessAccountId,
            amount: data.amount.toString(),
            paidOn: data.paidOn.toISOString(),
          },
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        return created;
      });
      return ok(payment);
    } catch (error) {
      if (error instanceof PostingFailure) return err(error.message);
      throw error;
    }
  }

  /**
   * Record a payment made to a payee (employee, subscription, etc.) against
   * a confirmed expense entry. Posts DR Payee (payable down), CR Business
   * (cash out), and increases amount_paid on the expense entry.
   */
  async recordExpensePayment(
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<Payment>> {
    const parsed = recordExpensePaymentSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    const entry = await new ExpenseEntryRepository(this.db).findById(
      data.expenseEntryId,
    );
    if (!entry) {
      return err(`Expense entry ${data.expenseEntryId} was not found`);
    }
    if (entry.state !== "CONFIRMED") {
      return err(
        `Cannot pay an unconfirmed expense entry (state: ${entry.state})`,
      );
    }
    if (data.amount > entry.amountDue) {
      return err(
        `Payment of ${data.amount} exceeds the outstanding amount (${entry.amountDue})`,
      );
    }

    const businessCheck = await this.assertIsBusinessAccount(
      data.businessAccountId,
    );
    if (!businessCheck.ok) return err(businessCheck.error);

    try {
      const payment = await this.db.$transaction(async (tx) => {
        const created = await new PaymentRepository(tx).create({
          expenseEntryId: entry.id,
          businessAccountId: data.businessAccountId,
          amount: data.amount,
          paidOn: data.paidOn,
          description: data.description ?? null,
        });
        // A fee, if any, is realised when the payment settles the entry: the
        // payee is paid the gross, the fee adds to cash out, and the fee is
        // recorded as a real cost against Transaction Fees.
        const settles = data.amount === entry.amountDue;
        const feeApplied =
          settles && entry.feeAmount && entry.feeAmount > 0n
            ? entry.feeAmount
            : 0n;
        const expensePostings: PostingLine[] = [
          {
            debitAccountId: entry.payeeAccountId,
            creditAccountId: data.businessAccountId,
            amount: data.amount,
          },
        ];
        if (feeApplied > 0n) {
          const feeAccount = await new AccountRepository(
            tx,
          ).findOrCreateTransactionFeesAccount();
          expensePostings.push({
            debitAccountId: feeAccount.id,
            creditAccountId: data.businessAccountId,
            amount: feeApplied,
            description: feeLineDescription(
              entry.feeMethod,
              entry.feeLabel,
              entry.description,
            ),
          });
        }
        await new PostingService().post(tx, {
          entryType: "PAYMENT",
          sourceType: "PAYMENT",
          sourceId: created.id,
          effectiveDate: data.paidOn,
          description: `Payment made for: ${entry.description}`,
          postings: expensePostings,
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        await tx.expenseEntry.update({
          where: { id: entry.id },
          data: {
            amountPaid: { increment: data.amount },
            amountDue: { decrement: data.amount },
          },
        });
        await new AuditLogRepository(tx).record({
          action: "CONFIRM",
          entityType: "Payment",
          entityId: created.id,
          summary: `Payment of ${data.amount.toString()} recorded for expense "${entry.description}"`,
          after: {
            id: created.id,
            expenseEntryId: entry.id,
            businessAccountId: data.businessAccountId,
            amount: data.amount.toString(),
            paidOn: data.paidOn.toISOString(),
          },
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        return created;
      });
      return ok(payment);
    } catch (error) {
      if (error instanceof PostingFailure) return err(error.message);
      throw error;
    }
  }

  /** Verify an account exists and sits under the BUSINESS category - only
   *  business accounts can hold cash for payments. */
  private async assertIsBusinessAccount(
    accountId: string,
  ): Promise<Result<undefined>> {
    const account = await this.db.account.findUnique({
      where: { id: accountId },
      include: { category: true },
    });
    if (!account) return err(`Account ${accountId} was not found`);
    if (account.category.key !== "BUSINESS") {
      return err(
        `Account "${account.name}" is in category ${account.category.key}; payments require a Business account`,
      );
    }
    return ok(undefined);
  }
}
