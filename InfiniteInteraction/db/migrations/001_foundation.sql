CREATE TABLE users (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 80),
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'creator' CHECK (role IN ('creator','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE login_limits (
  username text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE projects (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  schema_version integer NOT NULL DEFAULT 1,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  document jsonb NOT NULL,
  undo_stack jsonb NOT NULL DEFAULT '[]',
  redo_stack jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_owner ON projects(owner_id,updated_at DESC);
CREATE TABLE commands (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  request_hash text NOT NULL,
  base_revision integer NOT NULL,
  result_revision integer NOT NULL,
  kind text NOT NULL,
  before_document jsonb NOT NULL,
  after_document jsonb NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,command_id),
  UNIQUE(project_id,result_revision)
);
CREATE TABLE assets (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  name text NOT NULL,
  type text NOT NULL CHECK(type IN ('video','image','audio')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','ready','failed')),
  storage_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_project ON assets(project_id);
