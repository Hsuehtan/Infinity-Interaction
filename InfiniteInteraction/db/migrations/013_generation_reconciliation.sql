CREATE TABLE generation_reconciliations (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id),
  provider_task_id text NOT NULL,
  evidence_reference text NOT NULL,
  provider_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);
