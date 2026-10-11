ALTER TABLE generation_billing_reconciliations
  ADD COLUMN basis text NOT NULL DEFAULT 'provider_receipt'
  CHECK (basis IN ('provider_receipt','approved_ceiling'));
