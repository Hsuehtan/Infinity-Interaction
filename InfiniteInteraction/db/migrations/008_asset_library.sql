ALTER TABLE assets ADD COLUMN archived_at timestamptz;

CREATE TABLE asset_commands (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES assets(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,command_id)
);

CREATE INDEX assets_project_active ON assets(project_id,created_at DESC) WHERE archived_at IS NULL;
