CREATE TABLE generic_submission_reviews (
 command_id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES users(id), request_hash text NOT NULL, evidence_reference text NOT NULL,
 response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
