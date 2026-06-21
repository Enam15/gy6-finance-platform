-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuance_date" DATE NOT NULL,
    "due_in_days" INTEGER NOT NULL DEFAULT 7,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "issuer_email" TEXT,
    "issuer_address" TEXT,
    "issuer_phone" TEXT,
    "bill_to_name" TEXT NOT NULL,
    "bill_to_address" TEXT,
    "bill_to_email" TEXT,
    "bill_to_phone" TEXT,
    "bill_to_tin" TEXT,
    "pay_bank" TEXT,
    "pay_account_name" TEXT,
    "pay_account_type" TEXT,
    "pay_account_number" TEXT,
    "pay_branch" TEXT,
    "pay_routing" TEXT,
    "signatory_name" TEXT,
    "signatory_title" TEXT,
    "signatory_phone" TEXT,
    "signatory_email" TEXT,
    "notes" TEXT,
    "client_account_id" TEXT,
    "income_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_number_idx" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
