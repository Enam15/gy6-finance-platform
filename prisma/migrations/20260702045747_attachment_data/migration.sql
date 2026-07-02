/*
  Warnings:

  - You are about to drop the column `storage_key` on the `attachments` table. All the data in the column will be lost.
  - Added the required column `data` to the `attachments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "attachments" DROP COLUMN "storage_key",
ADD COLUMN     "data" BYTEA NOT NULL;
