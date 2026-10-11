ALTER TABLE generation_usage_events ADD COLUMN basis text;
CREATE TABLE generation_job_commands (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,command_id)
);
