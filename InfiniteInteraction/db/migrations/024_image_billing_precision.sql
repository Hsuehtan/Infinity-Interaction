ALTER TABLE generation_billing_reconciliations
  ADD COLUMN charged_milliyuan bigint CHECK(charged_milliyuan IS NULL OR charged_milliyuan >= 0);
