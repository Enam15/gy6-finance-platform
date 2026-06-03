import "dotenv/config";
import bcrypt from "bcryptjs";
import type {
  AccountCategoryKey,
  NormalBalance,
  SystemAccountKey,
} from "../lib/generated/prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Seeds the reference data the system depends on:
 *   - the six account categories (five user-facing plus SYSTEM)
 *   - the four hidden internal system accounts (with their normal balances
 *     and negative-balance permissions)
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
  normalBalance: NormalBalance;
  /** Whether the posting engine may let the balance drop below zero. */
  allowNegative: boolean;
}

const systemAccounts: SystemAccountSeed[] = [
  {
    systemKey: "REVENUE",
    name: "Revenue",
    description:
      "Counter-account for recognised income; credited when an income entry is confirmed.",
    normalBalance: "CREDIT",
    // Only ever credited (or debited by income reversals); should never go
    // below zero under correct usage. Keep the guard on.
    allowNegative: false,
  },
  {
    systemKey: "EXPENSE",
    name: "Expense",
    description:
      "Counter-account for recognised expenses; debited when an expense entry is confirmed.",
    normalBalance: "DEBIT",
    allowNegative: false,
  },
  {
    systemKey: "ADJUSTMENTS",
    name: "Adjustments",
    description:
      "Counter-account for manual balance adjustments, preserving double-entry.",
    normalBalance: "CREDIT",
    // Adjustments can swing either way (corrections up or down); the
    // negative-balance guard does not apply meaningfully here.
    allowNegative: true,
  },
  {
    systemKey: "OPENING_BALANCES",
    name: "Opening Balances",
    description:
      "Counter-account for the one-time opening balances entered at go-live.",
    normalBalance: "CREDIT",
    allowNegative: true,
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
        normalBalance: account.normalBalance,
        allowNegative: account.allowNegative,
      },
      update: {
        categoryId: systemCategory.id,
        name: account.name,
        description: account.description,
        normalBalance: account.normalBalance,
        allowNegative: account.allowNegative,
      },
    });
    console.log(
      `  system account: ${account.systemKey} (${account.normalBalance}${account.allowNegative ? ", allowNegative" : ""})`,
    );
  }

  await seedAppUsers();
  await seedPartners();

  console.log("Seed complete.");
}

interface AppUserSeed {
  email: string;
  name: string;
  password: string;
}

/**
 * Seed the two initial application users. Passwords come from env vars; if
 * neither is set the seed quietly skips this section so the rest of the
 * reference data still loads.
 *
 * Re-seeding does NOT reset an existing user's password unless
 * SEED_RESET_PASSWORDS=1 is set; otherwise only name + isActive are
 * refreshed. This means a user who has logged in and (eventually) changed
 * their password won't have it silently overwritten.
 */
async function seedAppUsers(): Promise<void> {
  const tashfeenPassword = process.env["SEED_TASHFEEN_PASSWORD"];
  const itmamPassword = process.env["SEED_ITMAM_PASSWORD"];

  const candidates: AppUserSeed[] = [];
  if (tashfeenPassword) {
    candidates.push({
      email: process.env["SEED_TASHFEEN_EMAIL"] ?? "tashfeen@gy6.local",
      name: "Tashfeen",
      password: tashfeenPassword,
    });
  }
  if (itmamPassword) {
    candidates.push({
      email: process.env["SEED_ITMAM_EMAIL"] ?? "itmam@gy6.local",
      name: "Itmam",
      password: itmamPassword,
    });
  }

  if (candidates.length === 0) {
    console.log(
      "  app users: skipped (set SEED_TASHFEEN_PASSWORD and/or SEED_ITMAM_PASSWORD in .env)",
    );
    return;
  }

  const resetPasswords = process.env["SEED_RESET_PASSWORDS"] === "1";

  for (const user of candidates) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await prisma.appUser.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        isActive: true,
      },
      update: {
        name: user.name,
        isActive: true,
        ...(resetPasswords ? { passwordHash } : {}),
      },
    });
    console.log(
      `  app user: ${user.email}${resetPasswords ? " (password reset)" : ""}`,
    );
  }
}

interface PartnerSeed {
  /** Display name + unique key. */
  name: string;
  /** Founder-category Account name that receives this partner's distributions. */
  founderAccountName: string;
  /** Initial share ratio numerator. Denominator is sigma at distribution time. */
  ratio: number;
}

/**
 * Seed the GY6 profit-distribution partners and their initial share slices.
 *
 * Idempotent: each Founder account is created only if missing (matched by
 * name + FOUNDER category), Partner rows upsert on `name`, and
 * PartnerShareSlice rows upsert on (partnerId, effectiveFrom).
 *
 * Initial split is Tashfeen 65 / Itmam 35 effective 2026-01-01 - matches
 * the locked PRD decision; any 2026 quarter resolves to this slice.
 */
async function seedPartners(): Promise<void> {
  const founderCat = await prisma.accountCategory.findUniqueOrThrow({
    where: { key: "FOUNDER" },
  });
  const effectiveFrom = new Date(Date.UTC(2026, 0, 1));

  const partners: PartnerSeed[] = [
    { name: "Tashfeen", founderAccountName: "Tashfeen Founder", ratio: 65 },
    { name: "Itmam", founderAccountName: "Itmam Founder", ratio: 35 },
  ];

  for (const p of partners) {
    let account = await prisma.account.findFirst({
      where: { name: p.founderAccountName, categoryId: founderCat.id },
    });
    if (!account) {
      account = await prisma.account.create({
        data: {
          categoryId: founderCat.id,
          name: p.founderAccountName,
          normalBalance: "DEBIT",
          description: `Profit-distribution account for ${p.name}`,
        },
      });
    }

    const partner = await prisma.partner.upsert({
      where: { name: p.name },
      create: {
        name: p.name,
        founderAccountId: account.id,
        isActive: true,
      },
      update: { isActive: true },
    });

    await prisma.partnerShareSlice.upsert({
      where: {
        partnerId_effectiveFrom: {
          partnerId: partner.id,
          effectiveFrom,
        },
      },
      create: {
        partnerId: partner.id,
        ratio: p.ratio,
        effectiveFrom,
      },
      update: { ratio: p.ratio },
    });

    console.log(
      `  partner: ${p.name} (ratio ${p.ratio}, founder=${p.founderAccountName})`,
    );
  }
}

seed()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
