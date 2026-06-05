-- CreateEnum
CREATE TYPE "RecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "expense_entries" ADD COLUMN     "renewal_template_id" TEXT;

-- AlterTable
ALTER TABLE "income_entries" ADD COLUMN     "renewal_template_id" TEXT;

-- CreateTable
CREATE TABLE "renewal_templates" (
    "id" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 0,
    "interval_count" INTEGER NOT NULL,
    "interval_unit" "RecurrenceUnit" NOT NULL,
    "next_run_on" DATE NOT NULL,
    "end_on" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "renewal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "renewal_templates_is_active_next_run_on_idx" ON "renewal_templates"("is_active", "next_run_on");

-- CreateIndex
CREATE INDEX "renewal_templates_account_id_idx" ON "renewal_templates"("account_id");

-- CreateIndex
CREATE INDEX "renewal_templates_category_id_idx" ON "renewal_templates"("category_id");

-- CreateIndex
CREATE INDEX "expense_entries_renewal_template_id_idx" ON "expense_entries"("renewal_template_id");

-- CreateIndex
CREATE INDEX "income_entries_renewal_template_id_idx" ON "income_entries"("renewal_template_id");

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_renewal_template_id_fkey" FOREIGN KEY ("renewal_template_id") REFERENCES "renewal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_renewal_template_id_fkey" FOREIGN KEY ("renewal_template_id") REFERENCES "renewal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_templates" ADD CONSTRAINT "renewal_templates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_templates" ADD CONSTRAINT "renewal_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
