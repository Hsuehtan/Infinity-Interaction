CREATE TABLE model_credentials (
  id uuid PRIMARY KEY,
  key_id text NOT NULL,
  ciphertext bytea NOT NULL,
  iv bytea NOT NULL CHECK(octet_length(iv)=12),
  tag bytea NOT NULL CHECK(octet_length(tag)=16),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE model_connections (
  id uuid PRIMARY KEY,
  current_version integer NOT NULL DEFAULT 1 CHECK(current_version>0),
  enabled boolean NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(NOT is_default OR (enabled AND archived_at IS NULL))
);
CREATE UNIQUE INDEX model_single_default ON model_connections(is_default) WHERE is_default;
CREATE TABLE model_connection_versions (
  connection_id uuid NOT NULL REFERENCES model_connections(id),
  version integer NOT NULL CHECK(version>0),
  config jsonb NOT NULL,
  credential_ref uuid REFERENCES model_credentials(id),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(connection_id,version)
);
ALTER TABLE model_connections ADD CONSTRAINT model_current_version FOREIGN KEY(id,current_version) REFERENCES model_connection_versions(connection_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE model_connection_commands (
  command_id uuid PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES model_connections(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  request_hash text NOT NULL,
  action text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
