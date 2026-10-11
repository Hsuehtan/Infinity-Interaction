CREATE TABLE publish_builds (
  version_id uuid PRIMARY KEY REFERENCES published_versions(id) ON DELETE CASCADE,
  generation integer NOT NULL CHECK(generation>0),
  status text NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
  share_scope text NOT NULL CHECK(share_scope='unlisted'),
  confirmed_by uuid NOT NULL REFERENCES users(id),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  artifact_key text,
  artifact_hash text,
  completed_at timestamptz,
  CHECK(status<>'succeeded' OR (artifact_key IS NOT NULL AND artifact_hash IS NOT NULL))
);
CREATE INDEX publish_build_queue ON publish_builds(status,lease_until);
CREATE TABLE publish_build_commands (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  version_id uuid NOT NULL REFERENCES published_versions(id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  generation integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,command_id)
);
