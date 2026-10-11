ALTER TABLE image_generation_reconciliations
  ALTER COLUMN result_url DROP NOT NULL,
  ADD COLUMN outcome text NOT NULL DEFAULT 'result_recovered'
    CHECK (outcome IN ('result_recovered','not_generated')),
  ADD CONSTRAINT image_reconciliation_result_matches_outcome
    CHECK ((outcome='result_recovered' AND result_url IS NOT NULL)
      OR (outcome='not_generated' AND result_url IS NULL));
