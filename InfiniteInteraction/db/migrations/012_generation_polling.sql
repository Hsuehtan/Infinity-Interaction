ALTER TABLE generation_jobs ADD COLUMN next_poll_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE generation_jobs ADD COLUMN poll_attempts integer NOT NULL DEFAULT 0 CHECK(poll_attempts >= 0);
ALTER TABLE generation_jobs ADD COLUMN result_url text;
ALTER TABLE generation_jobs ADD COLUMN reported_usage_seconds numeric;
ALTER TABLE generation_jobs ADD COLUMN reported_duration numeric;
ALTER TABLE generation_jobs ADD COLUMN reported_ratio text;
ALTER TABLE generation_jobs ADD COLUMN provider_terminal_at timestamptz;
CREATE INDEX generation_jobs_poll_due ON generation_jobs(next_poll_at,created_at) WHERE status IN ('running','cancel_requested') AND provider_task_id IS NOT NULL;
