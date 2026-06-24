-- DropIndex
DROP INDEX "expense_entries_state_idx";

-- DropIndex
DROP INDEX "income_entries_state_idx";

-- CreateIndex
CREATE INDEX "expense_entries_state_entry_date_idx" ON "expense_entries"("state", "entry_date");

-- CreateIndex
CREATE INDEX "income_entries_state_entry_date_idx" ON "income_entries"("state", "entry_date");
