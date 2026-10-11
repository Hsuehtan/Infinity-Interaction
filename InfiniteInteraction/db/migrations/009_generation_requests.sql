CREATE TABLE generation_requests (
  id uuid NOT NULL,
  version integer NOT NULL CHECK(version > 0),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES conversation_messages(id),
  created_by uuid NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK(status IN ('pending','superseded','cancelled','submitted','expired')),
  request_snapshot jsonb NOT NULL,
  context_snapshot jsonb NOT NULL,
  connection_id uuid NOT NULL,
  connection_version integer NOT NULL,
  estimate jsonb NOT NULL,
  estimate_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(id,version),
  FOREIGN KEY(connection_id,connection_version) REFERENCES model_connection_versions(connection_id,version)
);
CREATE UNIQUE INDEX generation_one_pending_per_message ON generation_requests(project_id,message_id) WHERE status='pending';
CREATE INDEX generation_requests_project ON generation_requests(project_id,created_at DESC);

CREATE TABLE generation_request_commands (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,command_id)
);
