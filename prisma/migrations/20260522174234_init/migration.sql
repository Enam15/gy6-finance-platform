-- CreateEnum
CREATE TYPE "AccountCategoryKey" AS ENUM ('BUSINESS', 'FOUNDER', 'CLIENT', 'EMPLOYEE', 'SUBSCRIPTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SystemAccountKey" AS ENUM ('REVENUE', 'EXPENSE', 'ADJUSTMENTS', 'OPENING_BALANCES');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'REVERSE', 'TRANSFER', 'ADJUST', 'RENEW', 'EXPORT');

-- CreateTable
CREATE TABLE "account_categories" (
    "id" TEXT NOT NULL,
    "key" "AccountCategoryKey" NOT NULL,
    "name" TEXT NOT NULL,
    "balance_visible" BOOLEAN NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system_key" "SystemAccountKey",
    "description" TEXT,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "allow_negative" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "actor_id" TEXT,
    "actor_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_categories_key_key" ON "account_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_system_key_key" ON "accounts"("system_key");

-- CreateIndex
CREATE INDEX "accounts_category_id_idx" ON "accounts"("category_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
