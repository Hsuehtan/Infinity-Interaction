CREATE TABLE conversation_messages (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sequence bigint NOT NULL CHECK(sequence > 0),
  id uuid NOT NULL UNIQUE,
  client_message_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('user','assistant')),
  body text NOT NULL CHECK(length(body) BETWEEN 1 AND 20000),
  request_hash text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,sequence),
  UNIQUE(project_id,client_message_id)
);
CREATE TABLE conversation_drafts (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK(revision >= 0),
  body text NOT NULL CHECK(length(body) <= 20000),
  updated_by uuid NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE conversation_draft_commands (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,command_id)
);
