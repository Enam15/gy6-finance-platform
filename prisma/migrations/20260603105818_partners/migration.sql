-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "founder_account_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_share_slices" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "ratio" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_share_slices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributions" (
    "id" TEXT NOT NULL,
    "quarter_start" DATE NOT NULL,
    "net_amount" BIGINT NOT NULL,
    "source_account_id" TEXT NOT NULL,
    "description" TEXT,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_shares" (
    "id" TEXT NOT NULL,
    "distribution_id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "ratio" INTEGER NOT NULL,
    "ratio_denominator" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "distribution_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partners_name_key" ON "partners"("name");

-- CreateIndex
CREATE UNIQUE INDEX "partners_founder_account_id_key" ON "partners"("founder_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_share_slices_partner_id_effective_from_key" ON "partner_share_slices"("partner_id", "effective_from");

-- CreateIndex
CREATE INDEX "distributions_quarter_start_idx" ON "distributions"("quarter_start");

-- CreateIndex
CREATE INDEX "distributions_source_account_id_idx" ON "distributions"("source_account_id");

-- CreateIndex
CREATE INDEX "distribution_shares_distribution_id_idx" ON "distribution_shares"("distribution_id");

-- CreateIndex
CREATE INDEX "distribution_shares_partner_id_idx" ON "distribution_shares"("partner_id");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_founder_account_id_fkey" FOREIGN KEY ("founder_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_share_slices" ADD CONSTRAINT "partner_share_slices_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributions" ADD CONSTRAINT "distributions_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_shares" ADD CONSTRAINT "distribution_shares_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_shares" ADD CONSTRAINT "distribution_shares_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
