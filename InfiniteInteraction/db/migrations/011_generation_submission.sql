ALTER TABLE generation_jobs ADD COLUMN last_error_code text;
ALTER TABLE generation_jobs ADD COLUMN provider_submitted_at timestamptz;
CREATE UNIQUE INDEX generation_provider_task_identity ON generation_jobs(connection_id,provider_task_id) WHERE provider_task_id IS NOT NULL;
