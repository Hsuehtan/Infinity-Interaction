ALTER TABLE generation_jobs ADD COLUMN result_asset_id uuid;
ALTER TABLE generation_jobs ADD COLUMN ingest_attempts integer NOT NULL DEFAULT 0 CHECK(ingest_attempts >= 0);
ALTER TABLE generation_jobs ADD COLUMN next_ingest_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX generation_jobs_result_asset ON generation_jobs(result_asset_id) WHERE result_asset_id IS NOT NULL;
CREATE INDEX generation_jobs_ingest_due ON generation_jobs(next_ingest_at,created_at) WHERE status='ingesting';
