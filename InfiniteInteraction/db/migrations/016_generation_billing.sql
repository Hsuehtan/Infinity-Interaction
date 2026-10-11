ALTER TABLE generation_jobs ADD COLUMN accounting_finalized_at timestamptz;
CREATE TABLE generation_billing_reconciliations (
  job_id uuid PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id),
  charged_cents bigint NOT NULL CHECK(charged_cents >= 0),
  evidence_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
