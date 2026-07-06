-- Custom account categories with user-defined fields.
-- The seeded categories keep their enum key; user-created ones have key = NULL
-- and carry their own normal balance + custom field definitions.
ALTER TABLE "account_categories" ALTER COLUMN "key" DROP NOT NULL;
ALTER TABLE "account_categories" ADD COLUMN "normal_balance" "NormalBalance";
ALTER TABLE "account_categories" ADD COLUMN "custom_fields" JSONB;

-- Per-account values for the category's custom fields.
ALTER TABLE "accounts" ADD COLUMN "custom_values" JSONB;
