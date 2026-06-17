-- CreateEnum
CREATE TYPE "FeeMethod" AS ENUM ('BANK', 'UPWORK', 'ONLINE_WALLET');

-- AlterEnum
ALTER TYPE "SystemAccountKey" ADD VALUE 'TRANSACTION_FEES';

-- AlterTable
ALTER TABLE "expense_entries" ADD COLUMN     "fee_amount" BIGINT,
ADD COLUMN     "fee_bps" INTEGER,
ADD COLUMN     "fee_label" TEXT,
ADD COLUMN     "fee_method" "FeeMethod";

-- AlterTable
ALTER TABLE "income_entries" ADD COLUMN     "fee_amount" BIGINT,
ADD COLUMN     "fee_bps" INTEGER,
ADD COLUMN     "fee_label" TEXT,
ADD COLUMN     "fee_method" "FeeMethod";

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "fee_amount" BIGINT,
ADD COLUMN     "fee_bps" INTEGER,
ADD COLUMN     "fee_label" TEXT,
ADD COLUMN     "fee_method" "FeeMethod";
