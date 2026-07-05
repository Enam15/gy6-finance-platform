-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "payment_link_short_url" TEXT,
ADD COLUMN     "payment_link_url" TEXT,
ADD COLUMN     "payment_type" TEXT NOT NULL DEFAULT 'BANK';
