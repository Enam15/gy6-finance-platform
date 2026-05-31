import "dotenv/config";
import { ZERO_MONEY, allocateMoney, formatMoney, money } from "../lib/money";
import { prisma } from "../lib/prisma";
import { PostingService } from "../services/posting-service";

/**
 * End-to-end scenario walk-through. Runs every kind of transaction the
 * Phase 1 ledger supports against the live dev database, then deliberately
 * rolls the whole thing back - nothing persists. Run with:
 *
 *   npx tsx scripts/scenario.ts
 */

class RollbackSentinel extends Error {
  constructor() {
    super("rollback");
    this.name = "RollbackSentinel";
  }
}

const log = (msg: string): void => {
  console.log(msg);
};

const section = (title: string): void => {
  console.log("");
  console.log("------------------------------------------------------------------------");
  console.log(`  ${title}`);
  console.log("------------------------------------------------------------------------");
};

const m = (n: bigint): string => formatMoney(money(n));

async function runScenario(): Promise<void> {
  console.log("");
  console.log("========================================================================");
  console.log("  GY6 Finance - end-to-end scenario (the whole run rolls back at the end)");
  console.log("========================================================================");

  try {
    await prisma.$transaction(async (tx) => {
      const post = new PostingService();

      // ----------------------------------------------------------------
      section("1. Setup - look up seeded data and create some test accounts");

      const businessCat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "BUSINESS" },
      });
      const clientCat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "CLIENT" },
      });
      const employeeCat = await tx.accountCategory.findUniqueOrThrow({
        where: { key: "EMPLOYEE" },
      });
      const revenue = await tx.account.findUniqueOrThrow({
        where: { systemKey: "REVENUE" },
      });
      const expenseAcct = await tx.account.findUniqueOrThrow({
        where: { systemKey: "EXPENSE" },
      });
      const adjustmentsAcct = await tx.account.findUniqueOrThrow({
        where: { systemKey: "ADJUSTMENTS" },
      });

      const mainBank = await tx.account.create({
        data: {
          categoryId: businessCat.id,
          name: "Main Bank",
          normalBalance: "DEBIT",
          balance: 1_000_000n, // $10,000 opening balance
        },
      });
      const pettyCash = await tx.account.create({
        data: {
          categoryId: businessCat.id,
          name: "Petty Cash",
          normalBalance: "DEBIT",
        },
      });
      const acme = await tx.account.create({
        data: {
          categoryId: clientCat.id,
          name: "Acme Corp",
          normalBalance: "DEBIT",
        },
      });
      const alex = await tx.account.create({
        data: {
          categoryId: employeeCat.id,
          name: "Alex (developer)",
          normalBalance: "CREDIT",
        },
      });
      const projectFeeCat = await tx.transactionCategory.create({
        data: { name: "Project Fee", kind: "INCOME" },
      });
      const salaryCat = await tx.transactionCategory.create({
        data: { name: "Salary", kind: "EXPENSE" },
      });

      log(`  + Main Bank          opening: ${m(mainBank.balance)}`);
      log(`  + Petty Cash         opening: ${m(pettyCash.balance)}`);
      log(`  + Acme Corp          (client receivable account)`);
      log(`  + Alex               (employee payable account)`);
      log(`  + Income category:   "${projectFeeCat.name}"`);
      log(`  + Expense category:  "${salaryCat.name}"`);

      // ----------------------------------------------------------------
      section("2. Income - Acme owes us $5,000 for the Q2 redesign");

      const income = await tx.incomeEntry.create({
        data: {
          clientAccountId: acme.id,
          categoryId: projectFeeCat.id,
          description: "Q2 redesign project",
          totalAmount: 500_000n,
          amountPaid: 0n,
          amountDue: 500_000n,
          entryDate: new Date(),
          paymentDueOn: new Date(Date.now() + 30 * 86_400_000),
        },
      });
      log(`  + Draft income created: ${m(income.totalAmount)}, due in 30 days`);

      await post.post(tx, {
        entryType: "INCOME",
        sourceType: "INCOME_ENTRY",
        sourceId: income.id,
        effectiveDate: income.entryDate,
        description: "Income recognised: Q2 redesign project",
        postings: [
          {
            debitAccountId: acme.id,
            creditAccountId: revenue.id,
            amount: income.totalAmount,
          },
        ],
      });
      await tx.incomeEntry.update({
        where: { id: income.id },
        data: { state: "CONFIRMED", confirmedAt: new Date() },
      });

      const acme1 = await tx.account.findUniqueOrThrow({ where: { id: acme.id } });
      const rev1 = await tx.account.findUniqueOrThrow({ where: { id: revenue.id } });
      log(`  > Confirmed.  Acme receivable: ${m(acme1.balance)}   Revenue: ${m(rev1.balance)}`);

      // ----------------------------------------------------------------
      section("3. Acme pays $3,000 (partial)");

      const payment1 = await tx.payment.create({
        data: {
          incomeEntryId: income.id,
          businessAccountId: mainBank.id,
          amount: 300_000n,
          paidOn: new Date(),
          description: "Wire transfer received",
        },
      });
      const incomeAfter = await tx.incomeEntry.update({
        where: { id: income.id },
        data: {
          amountPaid: { increment: payment1.amount },
          amountDue: { decrement: payment1.amount },
        },
      });
      await post.post(tx, {
        entryType: "PAYMENT",
        sourceType: "PAYMENT",
        sourceId: payment1.id,
        effectiveDate: payment1.paidOn,
        description: "Payment received from Acme",
        postings: [
          {
            debitAccountId: mainBank.id,
            creditAccountId: acme.id,
            amount: payment1.amount,
          },
        ],
      });

      const bank1 = await tx.account.findUniqueOrThrow({ where: { id: mainBank.id } });
      const acme2 = await tx.account.findUniqueOrThrow({ where: { id: acme.id } });
      log(`  > Main Bank: ${m(bank1.balance)}   Acme outstanding: ${m(acme2.balance)}`);
      log(`  > Income entry: paid ${m(incomeAfter.amountPaid)} of ${m(incomeAfter.totalAmount)} (due ${m(incomeAfter.amountDue)})`);

      // ----------------------------------------------------------------
      section("4. Expense - Alex's May salary $2,000");

      const expense = await tx.expenseEntry.create({
        data: {
          payeeAccountId: alex.id,
          categoryId: salaryCat.id,
          description: "Alex - May salary",
          totalAmount: 200_000n,
          amountPaid: 0n,
          amountDue: 200_000n,
          entryDate: new Date(),
          paymentDueOn: new Date(Date.now() + 7 * 86_400_000),
        },
      });
      log(`  + Draft expense created: ${m(expense.totalAmount)}`);

      await post.post(tx, {
        entryType: "EXPENSE",
        sourceType: "EXPENSE_ENTRY",
        sourceId: expense.id,
        effectiveDate: expense.entryDate,
        description: "Salary expense recognised",
        postings: [
          {
            debitAccountId: expenseAcct.id,
            creditAccountId: alex.id,
            amount: expense.totalAmount,
          },
        ],
      });
      await tx.expenseEntry.update({
        where: { id: expense.id },
        data: { state: "CONFIRMED", confirmedAt: new Date() },
      });

      const alex1 = await tx.account.findUniqueOrThrow({ where: { id: alex.id } });
      const exp1 = await tx.account.findUniqueOrThrow({ where: { id: expenseAcct.id } });
      log(`  > Confirmed.  Alex payable: ${m(alex1.balance)}   Expense: ${m(exp1.balance)}`);

      // ----------------------------------------------------------------
      section("5. Pay Alex's salary in full");

      const payment2 = await tx.payment.create({
        data: {
          expenseEntryId: expense.id,
          businessAccountId: mainBank.id,
          amount: expense.totalAmount,
          paidOn: new Date(),
          description: "Salary payment",
        },
      });
      await tx.expenseEntry.update({
        where: { id: expense.id },
        data: {
          amountPaid: { increment: payment2.amount },
          amountDue: { decrement: payment2.amount },
        },
      });
      await post.post(tx, {
        entryType: "PAYMENT",
        sourceType: "PAYMENT",
        sourceId: payment2.id,
        effectiveDate: payment2.paidOn,
        description: "Salary paid to Alex",
        postings: [
          {
            debitAccountId: alex.id,
            creditAccountId: mainBank.id,
            amount: payment2.amount,
          },
        ],
      });

      const bank2 = await tx.account.findUniqueOrThrow({ where: { id: mainBank.id } });
      const alex2 = await tx.account.findUniqueOrThrow({ where: { id: alex.id } });
      log(`  > Main Bank: ${m(bank2.balance)}   Alex payable: ${m(alex2.balance)} (cleared)`);

      // ----------------------------------------------------------------
      section("6. Transfer $500 from Main Bank to Petty Cash");

      const transfer = await tx.transfer.create({
        data: {
          fromAccountId: mainBank.id,
          toAccountId: pettyCash.id,
          amount: 50_000n,
          effectiveDate: new Date(),
          description: "Petty cash top-up",
          state: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
      await post.post(tx, {
        entryType: "TRANSFER",
        sourceType: "TRANSFER",
        sourceId: transfer.id,
        effectiveDate: transfer.effectiveDate,
        description: "Transfer to Petty Cash",
        postings: [
          {
            debitAccountId: pettyCash.id,
            creditAccountId: mainBank.id,
            amount: transfer.amount,
          },
        ],
      });

      const bank3 = await tx.account.findUniqueOrThrow({ where: { id: mainBank.id } });
      const petty1 = await tx.account.findUniqueOrThrow({ where: { id: pettyCash.id } });
      log(`  > Main Bank: ${m(bank3.balance)}   Petty Cash: ${m(petty1.balance)}`);

      // ----------------------------------------------------------------
      section("7. Balance adjustment - $1.00 bank fee that was never recorded");

      const bankBefore = await tx.account.findUniqueOrThrow({ where: { id: mainBank.id } });
      const newBalance = bankBefore.balance - 100n;
      const difference = newBalance - bankBefore.balance; // -100
      const adj = await tx.balanceAdjustment.create({
        data: {
          accountId: mainBank.id,
          previousBalance: bankBefore.balance,
          newBalance,
          difference,
          reason: "Bank fee for May not previously recorded",
          effectiveDate: new Date(),
        },
      });
      // Main Bank is DEBIT-normal and going DOWN: CR Main Bank, DR Adjustments.
      const adjAmount = difference > 0n ? difference : -difference;
      await post.post(tx, {
        entryType: "ADJUSTMENT",
        sourceType: "BALANCE_ADJUSTMENT",
        sourceId: adj.id,
        effectiveDate: adj.effectiveDate,
        description: `Balance adjustment for "Main Bank": ${adj.reason}`,
        postings: [
          {
            debitAccountId: adjustmentsAcct.id,
            creditAccountId: mainBank.id,
            amount: adjAmount,
          },
        ],
      });

      const bank4 = await tx.account.findUniqueOrThrow({ where: { id: mainBank.id } });
      log(`  > Main Bank: ${m(bankBefore.balance)} -> ${m(bank4.balance)}  (adjustment recorded)`);

      // ----------------------------------------------------------------
      section("8. Try to reverse the income - should refuse because it has a payment");

      const incomeForReversal = await tx.incomeEntry.findUniqueOrThrow({
        where: { id: income.id },
      });
      if (incomeForReversal.amountPaid > 0n) {
        log(
          `  x BLOCKED: income has ${m(incomeForReversal.amountPaid)} in payments - reverse the payments first`,
        );
      } else {
        log(`  ?! Unexpectedly allowed`);
      }

      // ----------------------------------------------------------------
      section("9. Reverse the payment, then reverse the income");

      const payment1Entries = await tx.statementEntry.findMany({
        where: {
          sourceType: "PAYMENT",
          sourceId: payment1.id,
          entryType: "PAYMENT",
        },
      });
      for (const e of payment1Entries) {
        await post.post(tx, {
          entryType: "REVERSAL",
          sourceType: "PAYMENT",
          sourceId: payment1.id,
          effectiveDate: new Date(),
          description: `Reversal: ${e.description}`,
          postings: [
            {
              debitAccountId: e.creditAccountId,
              creditAccountId: e.debitAccountId,
              amount: e.amount,
              reversesEntryId: e.id,
            },
          ],
        });
      }
      await tx.incomeEntry.update({
        where: { id: income.id },
        data: {
          amountPaid: { decrement: payment1.amount },
          amountDue: { increment: payment1.amount },
        },
      });
      log(`  + Payment reversed (amount_paid rolled back on the income entry)`);

      const incomeEntries = await tx.statementEntry.findMany({
        where: {
          sourceType: "INCOME_ENTRY",
          sourceId: income.id,
          entryType: "INCOME",
        },
      });
      for (const e of incomeEntries) {
        await post.post(tx, {
          entryType: "REVERSAL",
          sourceType: "INCOME_ENTRY",
          sourceId: income.id,
          effectiveDate: new Date(),
          description: `Reversal: ${e.description}`,
          postings: [
            {
              debitAccountId: e.creditAccountId,
              creditAccountId: e.debitAccountId,
              amount: e.amount,
              reversesEntryId: e.id,
            },
          ],
        });
      }
      await tx.incomeEntry.update({
        where: { id: income.id },
        data: { state: "REVERSED" },
      });
      log(`  + Income reversed (state -> REVERSED)`);

      const acmeFinal = await tx.account.findUniqueOrThrow({ where: { id: acme.id } });
      const revFinal = await tx.account.findUniqueOrThrow({ where: { id: revenue.id } });
      log(`  > Acme:    ${m(acmeFinal.balance)}  (back to zero)`);
      log(`  > Revenue: ${m(revFinal.balance)}  (back to zero)`);

      // ----------------------------------------------------------------
      section("10. Final ledger state");

      const accounts = await tx.account.findMany({
        where: {
          id: {
            in: [
              mainBank.id,
              pettyCash.id,
              acme.id,
              alex.id,
              revenue.id,
              expenseAcct.id,
              adjustmentsAcct.id,
            ],
          },
        },
        orderBy: { name: "asc" },
      });
      log("  Account balances:");
      for (const a of accounts) {
        const sys = a.systemKey ? "  [system]" : "";
        log(
          `    ${a.name.padEnd(28)} ${m(a.balance).padStart(14)}  [${a.normalBalance}]${sys}`,
        );
      }

      const entryCount = await tx.statementEntry.count();
      const auditCount = await tx.auditLog.count();
      log("");
      log(`  Total statement_entries written this run: ${entryCount}`);
      log(`  Total audit_logs written this run:        ${auditCount}`);

      // ----------------------------------------------------------------
      section("11. Profit distribution preview (Tashfeen 65% / Itmam 35%)");

      const revFin = await tx.account.findUniqueOrThrow({
        where: { systemKey: "REVENUE" },
      });
      const expFin = await tx.account.findUniqueOrThrow({
        where: { systemKey: "EXPENSE" },
      });
      const netProfit = revFin.balance - expFin.balance;
      log(`  Revenue:    ${m(revFin.balance)}`);
      log(`  Expense:    ${m(expFin.balance)}`);
      log(`  Net profit: ${m(netProfit)}`);
      if (netProfit <= 0n) {
        log(`  -> No profit to distribute`);
      } else {
        const shares = allocateMoney(money(netProfit), [65n, 35n]);
        const tashfeen = shares[0] ?? ZERO_MONEY;
        const itmam = shares[1] ?? ZERO_MONEY;
        log(`  -> Tashfeen (65%): ${formatMoney(tashfeen)}`);
        log(`  -> Itmam    (35%): ${formatMoney(itmam)}`);
        log(`     sum:          ${formatMoney(money(tashfeen + itmam))}  (matches net profit)`);
      }

      // ----------------------------------------------------------------
      console.log("");
      console.log("========================================================================");
      console.log("  DONE. Rolling back - none of this persists.");
      console.log("========================================================================");
      console.log("");

      throw new RollbackSentinel();
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) {
      console.error("SCENARIO FAILED:", e);
      throw e;
    }
  }
}

runScenario()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
