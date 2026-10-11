ALTER TABLE generation_jobs DROP CONSTRAINT generation_jobs_status_check;
ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_status_check
  CHECK(status IN ('queued','preparing','submitting','submit_unknown','running','ingesting','succeeded','failed','cancel_requested','cancelled'));
DROP INDEX generation_jobs_claim;
CREATE INDEX generation_jobs_claim ON generation_jobs(status,lease_until,created_at)
  WHERE status IN ('queued','preparing','submitting','running','ingesting');
