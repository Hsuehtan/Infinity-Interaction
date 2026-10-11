CREATE TABLE project_imports (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id),
  source_name text NOT NULL,
  source_hash text NOT NULL,
  source_bytes bytea NOT NULL,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,command_id)
);
CREATE INDEX project_imports_owner ON project_imports(owner_id,created_at DESC);
