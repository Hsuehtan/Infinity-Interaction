CREATE TABLE image_generation_reconciliations (
  job_id uuid PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id),
  result_url text NOT NULL,
  evidence_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
