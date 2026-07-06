-- Per-entry notes for income and expense entries (replaces the standalone
-- Notes tab). Free text, editable; not part of the immutable ledger.
ALTER TABLE "income_entries" ADD COLUMN "notes" TEXT;
ALTER TABLE "expense_entries" ADD COLUMN "notes" TEXT;
