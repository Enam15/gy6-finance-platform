-- Per-account toggle for whether the "Adjust balance" action is available.
-- Defaults to true so existing accounts keep the current behaviour.
ALTER TABLE "accounts" ADD COLUMN "allow_balance_adjust" BOOLEAN NOT NULL DEFAULT true;
