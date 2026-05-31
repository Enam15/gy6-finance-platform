/*
  Warnings (from Prisma migrate dev):

  - Added the required column `normal_balance` to the `accounts` table without a default value. This is not possible if the table is not empty.

  Hand-edited handling:

  - The AlterTable for `normal_balance` adds the column with a temporary
    DEFAULT 'DEBIT' to backfill existing rows, then drops the default so the
    final column matches the Prisma schema (NOT NULL, no default). The seed
    re-runs to set each system account's correct normal balance.
  - CHECK constraints are appended below to enforce accounting invariants
    (positive amounts, the amount_due formula, exactly-one-of on payments and
    attachments, distinct accounts on transfers and statement_entries, the
    balance-adjustment difference formula).
  - A trigger blocks UPDATE and DELETE on statement_entries (the append-only
    ledger) as defence in depth alongside the repository layer.
*/

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "EntryState" AS ENUM ('DRAFT', 'CONFIRMED', 'REVERSED');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "StatementEntryType" AS ENUM ('INCOME', 'EXPENSE', 'PAYMENT', 'TRANSFER', 'ADJUSTMENT', 'REVERSAL', 'OPENING_BALANCE');

-- CreateEnum
CREATE TYPE "StatementSourceType" AS ENUM ('INCOME_ENTRY', 'EXPENSE_ENTRY', 'PAYMENT', 'TRANSFER', 'BALANCE_ADJUSTMENT');

-- AlterTable (hand-edited: temporary DEFAULT 'DEBIT' to backfill the 4 existing system accounts, then dropped)
ALTER TABLE "accounts" ADD COLUMN     "normal_balance" "NormalBalance" NOT NULL DEFAULT 'DEBIT';
ALTER TABLE "accounts" ALTER COLUMN "normal_balance" DROP DEFAULT;

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_entries" (
    "id" TEXT NOT NULL,
    "transaction_group_id" TEXT NOT NULL,
    "entry_type" "StatementEntryType" NOT NULL,
    "debit_account_id" TEXT NOT NULL,
    "credit_account_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "source_type" "StatementSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "reverses_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "statement_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_entries" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "amount_paid" BIGINT NOT NULL DEFAULT 0,
    "amount_due" BIGINT NOT NULL,
    "entry_date" DATE NOT NULL,
    "payment_due_on" DATE NOT NULL,
    "state" "EntryState" NOT NULL DEFAULT 'DRAFT',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "income_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_entries" (
    "id" TEXT NOT NULL,
    "payee_account_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "amount_paid" BIGINT NOT NULL DEFAULT 0,
    "amount_due" BIGINT NOT NULL,
    "entry_date" DATE NOT NULL,
    "payment_due_on" DATE NOT NULL,
    "state" "EntryState" NOT NULL DEFAULT 'DRAFT',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "expense_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "income_entry_id" TEXT,
    "expense_entry_id" TEXT,
    "business_account_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "paid_on" DATE NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "from_account_id" TEXT NOT NULL,
    "to_account_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT,
    "effective_date" DATE NOT NULL,
    "state" "EntryState" NOT NULL DEFAULT 'DRAFT',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_adjustments" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "previous_balance" BIGINT NOT NULL,
    "new_balance" BIGINT NOT NULL,
    "difference" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "balance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "income_entry_id" TEXT,
    "expense_entry_id" TEXT,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_categories_name_kind_key" ON "transaction_categories"("name", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "statement_entries_reverses_entry_id_key" ON "statement_entries"("reverses_entry_id");

-- CreateIndex
CREATE INDEX "statement_entries_transaction_group_id_idx" ON "statement_entries"("transaction_group_id");

-- CreateIndex
CREATE INDEX "statement_entries_source_type_source_id_idx" ON "statement_entries"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "statement_entries_debit_account_id_idx" ON "statement_entries"("debit_account_id");

-- CreateIndex
CREATE INDEX "statement_entries_credit_account_id_idx" ON "statement_entries"("credit_account_id");

-- CreateIndex
CREATE INDEX "statement_entries_effective_date_idx" ON "statement_entries"("effective_date");

-- CreateIndex
CREATE INDEX "income_entries_client_account_id_idx" ON "income_entries"("client_account_id");

-- CreateIndex
CREATE INDEX "income_entries_category_id_idx" ON "income_entries"("category_id");

-- CreateIndex
CREATE INDEX "income_entries_state_idx" ON "income_entries"("state");

-- CreateIndex
CREATE INDEX "income_entries_payment_due_on_idx" ON "income_entries"("payment_due_on");

-- CreateIndex
CREATE INDEX "expense_entries_payee_account_id_idx" ON "expense_entries"("payee_account_id");

-- CreateIndex
CREATE INDEX "expense_entries_category_id_idx" ON "expense_entries"("category_id");

-- CreateIndex
CREATE INDEX "expense_entries_state_idx" ON "expense_entries"("state");

-- CreateIndex
CREATE INDEX "expense_entries_payment_due_on_idx" ON "expense_entries"("payment_due_on");

-- CreateIndex
CREATE INDEX "payments_income_entry_id_idx" ON "payments"("income_entry_id");

-- CreateIndex
CREATE INDEX "payments_expense_entry_id_idx" ON "payments"("expense_entry_id");

-- CreateIndex
CREATE INDEX "payments_business_account_id_idx" ON "payments"("business_account_id");

-- CreateIndex
CREATE INDEX "transfers_from_account_id_idx" ON "transfers"("from_account_id");

-- CreateIndex
CREATE INDEX "transfers_to_account_id_idx" ON "transfers"("to_account_id");

-- CreateIndex
CREATE INDEX "transfers_effective_date_idx" ON "transfers"("effective_date");

-- CreateIndex
CREATE INDEX "balance_adjustments_account_id_idx" ON "balance_adjustments"("account_id");

-- CreateIndex
CREATE INDEX "attachments_income_entry_id_idx" ON "attachments"("income_entry_id");

-- CreateIndex
CREATE INDEX "attachments_expense_entry_id_idx" ON "attachments"("expense_entry_id");

-- AddForeignKey
ALTER TABLE "statement_entries" ADD CONSTRAINT "statement_entries_debit_account_id_fkey" FOREIGN KEY ("debit_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_entries" ADD CONSTRAINT "statement_entries_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_entries" ADD CONSTRAINT "statement_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "statement_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_payee_account_id_fkey" FOREIGN KEY ("payee_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_income_entry_id_fkey" FOREIGN KEY ("income_entry_id") REFERENCES "income_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_expense_entry_id_fkey" FOREIGN KEY ("expense_entry_id") REFERENCES "expense_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_account_id_fkey" FOREIGN KEY ("business_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_income_entry_id_fkey" FOREIGN KEY ("income_entry_id") REFERENCES "income_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_expense_entry_id_fkey" FOREIGN KEY ("expense_entry_id") REFERENCES "expense_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-edited: CHECK constraints enforcing accounting invariants at the DB
-- ---------------------------------------------------------------------------

ALTER TABLE "statement_entries" ADD CONSTRAINT "statement_entries_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "statement_entries" ADD CONSTRAINT "statement_entries_distinct_accounts" CHECK ("debit_account_id" <> "credit_account_id");

ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_total_positive" CHECK ("total_amount" > 0);
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_paid_nonneg" CHECK ("amount_paid" >= 0);
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_paid_le_total" CHECK ("amount_paid" <= "total_amount");
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_due_formula" CHECK ("amount_due" = "total_amount" - "amount_paid");

ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_total_positive" CHECK ("total_amount" > 0);
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_paid_nonneg" CHECK ("amount_paid" >= 0);
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_paid_le_total" CHECK ("amount_paid" <= "total_amount");
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_due_formula" CHECK ("amount_due" = "total_amount" - "amount_paid");

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_exactly_one_entry" CHECK (("income_entry_id" IS NOT NULL) <> ("expense_entry_id" IS NOT NULL));

ALTER TABLE "transfers" ADD CONSTRAINT "transfers_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_distinct_accounts" CHECK ("from_account_id" <> "to_account_id");

ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_difference_formula" CHECK ("difference" = "new_balance" - "previous_balance");

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_exactly_one_entry" CHECK (("income_entry_id" IS NOT NULL) <> ("expense_entry_id" IS NOT NULL));
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_size_nonneg" CHECK ("size_bytes" >= 0);

-- ---------------------------------------------------------------------------
-- Hand-edited: append-only enforcement on the ledger
-- ---------------------------------------------------------------------------
-- statement_entries is the immutable ledger. The repository layer never
-- exposes UPDATE or DELETE on it, but a database trigger blocks them as a
-- defence in depth - corrections must be new REVERSAL rows.

CREATE OR REPLACE FUNCTION gy6_block_statement_entry_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'statement_entries is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER statement_entries_block_update
  BEFORE UPDATE ON "statement_entries"
  FOR EACH ROW EXECUTE FUNCTION gy6_block_statement_entry_mutation();

CREATE TRIGGER statement_entries_block_delete
  BEFORE DELETE ON "statement_entries"
  FOR EACH ROW EXECUTE FUNCTION gy6_block_statement_entry_mutation();
