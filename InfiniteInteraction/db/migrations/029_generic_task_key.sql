-- Preserve numeric task IDs for JSON polling while retaining namespace + text ID uniqueness.
ALTER TABLE generation_jobs ADD COLUMN provider_task_key jsonb;
