import "dotenv/config";
import { prisma } from "../lib/prisma";
import type { Result } from "../lib/result";
import { AccountService } from "@/services/account-service";
import { TransactionCategoryService } from "@/services/transaction-category-service";
import { IncomeService } from "@/services/income-service";
import { ExpenseService } from "@/services/expense-service";
import { PaymentService } from "@/services/payment-service";
import { TransferService } from "@/services/transfer-service";
import { BalanceAdjustmentService } from "@/services/balance-adjustment-service";
import { DistributionService } from "@/services/distribution-service";
import { RenewalService } from "@/services/renewal-service";

/**
 * Demo dataset for the GY6 Finance defence build. Populates a realistic
 * agency's books by driving the REAL services - so every figure is posted
 * through the double-entry engine with a correct ledger trail, not faked.
 *
 * Run AFTER the base seed (prisma/seed.ts). Idempotent guard: if the demo
 * accounts already exist, it skips. Invoke: `npm run db:seed:demo`.
 */

const actor = { actorId: null, actorLabel: "Demo data seed" };

/** Minor units from a major amount (e.g. 1234.50 -> 123450n). */
function minor(major: number): bigint {
  return BigInt(Math.round(major * 100));
}

/** Midnight-UTC Date from a YYYY-MM-DD string. */
function date(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** Unwrap a service Result or throw with context. */
function must<T>(result: Result<T>, label: string): T {
  if (!result.ok) throw new Error(`${label}: ${result.error}`);
  return result.value;
}

async function seedDemo(): Promise<void> {
  const existing = await prisma.account.findFirst({
    where: { name: "Meezan Business Account" },
  });
  if (existing) {
    console.log("Demo data already present - skipping.");
    return;
  }

  console.log("Seeding GY6 demo dataset...");

  const accountService = new AccountService();
  const categoryService = new TransactionCategoryService();
  const incomeService = new IncomeService();
  const expenseService = new ExpenseService();
  const paymentService = new PaymentService();
  const transferService = new TransferService();
  const adjustmentService = new BalanceAdjustmentService();
  const distributionService = new DistributionService();
  const renewalService = new RenewalService();

  // --- Account categories (seeded by the base seed) ---------------------
  const cat = async (key: string): Promise<string> => {
    const c = await prisma.accountCategory.findUniqueOrThrow({
      where: { key: key as never },
    });
    return c.id;
  };
  const businessCat = await cat("BUSINESS");
  const clientCat = await cat("CLIENT");
  const employeeCat = await cat("EMPLOYEE");
  const subscriptionCat = await cat("SUBSCRIPTION");

  // --- Accounts ---------------------------------------------------------
  const mkAccount = async (categoryId: string, name: string): Promise<string> =>
    must(
      await accountService.createAccount({ categoryId, name }, actor),
      `account ${name}`,
    ).id;

  const meezan = await mkAccount(businessCat, "Meezan Business Account");
  const hbl = await mkAccount(businessCat, "HBL Operating Account");
  const acme = await mkAccount(clientCat, "Acme Corp");
  const globex = await mkAccount(clientCat, "Globex Ltd");
  const initech = await mkAccount(clientCat, "Initech LLC");
  const mustafa = await mkAccount(employeeCat, "Mustafa Ahmed");
  const sara = await mkAccount(employeeCat, "Sara Khan");
  const adobe = await mkAccount(subscriptionCat, "Adobe Creative Cloud");
  const aws = await mkAccount(subscriptionCat, "AWS Hosting");
  console.log("  accounts created");

  // --- Transaction categories ------------------------------------------
  const mkCat = async (name: string, kind: "INCOME" | "EXPENSE"): Promise<string> =>
    must(await categoryService.create({ name, kind }, actor), `category ${name}`)
      .id;

  const projectFee = await mkCat("Project Fee", "INCOME");
  const retainer = await mkCat("Monthly Retainer", "INCOME");
  const consulting = await mkCat("Consulting", "INCOME");
  const salaries = await mkCat("Salaries", "EXPENSE");
  const software = await mkCat("Software Subscriptions", "EXPENSE");
  console.log("  transaction categories created");

  // --- Opening balances (via adjustments) ------------------------------
  must(
    await adjustmentService.createAdjustment(
      {
        accountId: meezan,
        newBalance: minor(800000),
        reason: "Opening balance at go-live",
        effectiveDate: date("2026-01-01"),
      },
      actor,
    ),
    "opening balance meezan",
  );
  must(
    await adjustmentService.createAdjustment(
      {
        accountId: hbl,
        newBalance: minor(200000),
        reason: "Opening balance at go-live",
        effectiveDate: date("2026-01-01"),
      },
      actor,
    ),
    "opening balance hbl",
  );
  console.log("  opening balances set");

  // --- Income: draft -> confirm -> (payment) ---------------------------
  const income = async (
    clientAccountId: string,
    categoryId: string,
    description: string,
    amount: number,
    entry: string,
    due: string,
    opts: { confirm?: boolean; pay?: number; payFrom?: string; paidOn?: string } = {},
  ): Promise<string> => {
    const entryId = must(
      await incomeService.createDraft(
        {
          clientAccountId,
          categoryId,
          description,
          totalAmount: minor(amount),
          entryDate: date(entry),
          paymentDueOn: date(due),
        },
        actor,
      ),
      `income ${description}`,
    ).id;
    if (opts.confirm !== false) {
      must(await incomeService.confirm(entryId, actor), `confirm ${description}`);
    }
    if (opts.pay && opts.payFrom && opts.paidOn) {
      must(
        await paymentService.recordIncomePayment(
          {
            incomeEntryId: entryId,
            businessAccountId: opts.payFrom,
            amount: minor(opts.pay),
            paidOn: date(opts.paidOn),
          },
          actor,
        ),
        `income payment ${description}`,
      );
    }
    return entryId;
  };

  await income(acme, projectFee, "Brand website build", 350000, "2026-02-10", "2026-03-10", { pay: 350000, payFrom: meezan, paidOn: "2026-03-05" });
  await income(globex, retainer, "March retainer", 120000, "2026-03-01", "2026-03-31", { pay: 60000, payFrom: meezan, paidOn: "2026-03-20" });
  await income(initech, consulting, "Cloud migration consulting", 90000, "2026-04-15", "2026-05-15");
  await income(acme, projectFee, "Mobile app phase 1", 500000, "2026-05-20", "2026-06-20");
  await income(globex, retainer, "June retainer", 120000, "2026-06-01", "2026-06-30", { confirm: false });
  console.log("  income entries created");

  // --- Expenses: draft -> confirm -> (payment) -------------------------
  const expense = async (
    payeeAccountId: string,
    categoryId: string,
    description: string,
    amount: number,
    entry: string,
    due: string,
    opts: { pay?: number; payFrom?: string; paidOn?: string } = {},
  ): Promise<string> => {
    const entryId = must(
      await expenseService.createDraft(
        {
          payeeAccountId,
          categoryId,
          description,
          totalAmount: minor(amount),
          entryDate: date(entry),
          paymentDueOn: date(due),
        },
        actor,
      ),
      `expense ${description}`,
    ).id;
    must(await expenseService.confirm(entryId, actor), `confirm ${description}`);
    if (opts.pay && opts.payFrom && opts.paidOn) {
      must(
        await paymentService.recordExpensePayment(
          {
            expenseEntryId: entryId,
            businessAccountId: opts.payFrom,
            amount: minor(opts.pay),
            paidOn: date(opts.paidOn),
          },
          actor,
        ),
        `expense payment ${description}`,
      );
    }
    return entryId;
  };

  await expense(mustafa, salaries, "February salary", 200000, "2026-02-01", "2026-02-05", { pay: 200000, payFrom: meezan, paidOn: "2026-02-05" });
  await expense(sara, salaries, "March salary", 150000, "2026-03-01", "2026-03-05", { pay: 150000, payFrom: meezan, paidOn: "2026-03-05" });
  await expense(adobe, software, "Adobe CC - April", 8000, "2026-04-01", "2026-04-10", { pay: 8000, payFrom: hbl, paidOn: "2026-04-08" });
  await expense(aws, software, "AWS hosting - May", 25000, "2026-05-01", "2026-05-10");
  await expense(mustafa, salaries, "June salary", 200000, "2026-06-01", "2026-06-05");
  console.log("  expense entries created");

  // --- Transfer between business accounts ------------------------------
  must(
    await transferService.createTransfer(
      {
        fromAccountId: meezan,
        toAccountId: hbl,
        amount: minor(100000),
        effectiveDate: date("2026-04-20"),
        description: "Top up operating account",
      },
      actor,
    ),
    "transfer",
  );
  console.log("  transfer created");

  // --- Q1 2026 profit distribution -------------------------------------
  must(
    await distributionService.runQuarter(
      {
        quarterStart: date("2026-01-01"),
        sourceAccountId: meezan,
        description: "Q1 2026 profit distribution",
      },
      actor,
    ),
    "distribution Q1",
  );
  console.log("  Q1 distribution run");

  // --- Renewal template + generated drafts -----------------------------
  must(
    await renewalService.createTemplate(
      {
        kind: "INCOME",
        name: "Acme - Support Retainer",
        accountId: acme,
        categoryId: retainer,
        description: "Monthly support retainer - Acme Corp",
        totalAmount: minor(75000),
        paymentTermsDays: 30,
        intervalCount: 1,
        intervalUnit: "MONTH",
        firstRunOn: date("2026-04-01"),
      },
      actor,
    ),
    "renewal template",
  );
  // Generate the due occurrences as of end of Q2 (deterministic: Apr/May/Jun).
  const summary = must(
    await renewalService.generateDue(actor, date("2026-06-30")),
    "generate renewals",
  );
  console.log(`  renewal template created; generated ${summary.totalCreated} draft(s)`);

  console.log("Demo dataset complete.");
}

seedDemo()
  .catch((error: unknown) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
