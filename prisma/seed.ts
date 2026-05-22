import "dotenv/config";
import type {
  AccountCategoryKey,
  SystemAccountKey,
} from "../lib/generated/prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Seeds the reference data the system depends on:
 *   - the six account categories (five user-facing plus SYSTEM)
 *   - the four hidden internal system accounts
 *
 * Idempotent: every record is upserted by its unique key, so the script is
 * safe to run repeatedly. Invoke with `npm run db:seed`.
 */

interface CategorySeed {
  key: AccountCategoryKey;
  name: string;
  balanceVisible: boolean;
  isSystem: boolean;
}

const categories: CategorySeed[] = [
  { key: "BUSINESS", name: "Business", balanceVisible: true, isSystem: false },
  { key: "FOUNDER", name: "Founder", balanceVisible: true, isSystem: false },
  { key: "CLIENT", name: "Client", balanceVisible: true, isSystem: false },
  { key: "EMPLOYEE", name: "Employee", balanceVisible: false, isSystem: false },
  {
    key: "SUBSCRIPTION",
    name: "Subscription",
    balanceVisible: false,
    isSystem: false,
  },
  { key: "SYSTEM", name: "System", balanceVisible: false, isSystem: true },
];

interface SystemAccountSeed {
  systemKey: SystemAccountKey;
  name: string;
  description: string;
}

const systemAccounts: SystemAccountSeed[] = [
  {
    systemKey: "REVENUE",
    name: "Revenue",
    description:
      "Counter-account for recognised income; credited when an income entry is confirmed.",
  },
  {
    systemKey: "EXPENSE",
    name: "Expense",
    description:
      "Counter-account for recognised expenses; debited when an expense entry is confirmed.",
  },
  {
    systemKey: "ADJUSTMENTS",
    name: "Adjustments",
    description:
      "Counter-account for manual balance adjustments, preserving double-entry.",
  },
  {
    systemKey: "OPENING_BALANCES",
    name: "Opening Balances",
    description:
      "Counter-account for the one-time opening balances entered at go-live.",
  },
];

async function seed(): Promise<void> {
  console.log("Seeding GY6 Finance reference data...");

  for (const category of categories) {
    await prisma.accountCategory.upsert({
      where: { key: category.key },
      create: category,
      update: {
        name: category.name,
        balanceVisible: category.balanceVisible,
        isSystem: category.isSystem,
      },
    });
    console.log(`  account category: ${category.key}`);
  }

  const systemCategory = await prisma.accountCategory.findUniqueOrThrow({
    where: { key: "SYSTEM" },
  });

  for (const account of systemAccounts) {
    await prisma.account.upsert({
      where: { systemKey: account.systemKey },
      create: {
        categoryId: systemCategory.id,
        name: account.name,
        description: account.description,
        systemKey: account.systemKey,
      },
      update: {
        categoryId: systemCategory.id,
        name: account.name,
        description: account.description,
      },
    });
    console.log(`  system account: ${account.systemKey}`);
  }

  console.log("Seed complete.");
}

seed()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
