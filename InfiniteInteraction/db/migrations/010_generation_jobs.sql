CREATE TABLE generation_budget_accounts (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  limit_cents bigint NOT NULL CHECK(limit_cents >= 0),
  reserved_cents bigint NOT NULL DEFAULT 0 CHECK(reserved_cents >= 0),
  spent_cents bigint NOT NULL DEFAULT 0 CHECK(spent_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(reserved_cents + spent_cents <= limit_cents)
);

CREATE TABLE generation_jobs (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  request_version integer NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  connection_id uuid NOT NULL,
  connection_version integer NOT NULL,
  request_snapshot jsonb NOT NULL,
  context_snapshot jsonb NOT NULL,
  estimate jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('queued','submitting','submit_unknown','running','ingesting','succeeded','failed','cancel_requested','cancelled')),
  reserved_cents bigint NOT NULL CHECK(reserved_cents >= 0),
  provider_task_id text,
  lease_token uuid,
  lease_until timestamptz,
  attempt integer NOT NULL DEFAULT 0 CHECK(attempt >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,request_version),
  FOREIGN KEY(request_id,request_version) REFERENCES generation_requests(id,version),
  FOREIGN KEY(connection_id,connection_version) REFERENCES model_connection_versions(connection_id,version)
);
CREATE INDEX generation_jobs_project ON generation_jobs(project_id,created_at DESC);
CREATE INDEX generation_jobs_claim ON generation_jobs(status,lease_until,created_at) WHERE status IN ('queued','submitting','running','ingesting');

CREATE TABLE generation_usage_events (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('reserve','settle','release')),
  amount_cents bigint NOT NULL CHECK(amount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id,kind)
);

CREATE TABLE generation_confirmation_commands (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  request_hash text NOT NULL,
  job_id uuid NOT NULL REFERENCES generation_jobs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,command_id)
);
