-- The current product has one video gateway. A gateway task may identify only
-- one product job, even if the administrator configured multiple connections.
DROP INDEX generation_provider_task_identity;
CREATE UNIQUE INDEX generation_provider_task_identity ON generation_jobs(provider_task_id)
  WHERE provider_task_id IS NOT NULL;
