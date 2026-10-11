ALTER TABLE assets ADD COLUMN expected_bytes bigint;
ALTER TABLE assets ADD COLUMN declared_mime text;
ALTER TABLE assets ADD COLUMN request_hash text;
ALTER TABLE assets ADD COLUMN content_hash text;
ALTER TABLE assets ADD COLUMN lease_token uuid;
ALTER TABLE assets ADD COLUMN lease_until timestamptz;
ALTER TABLE assets ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE assets ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX assets_processing ON assets(status,lease_until) WHERE status='processing';
