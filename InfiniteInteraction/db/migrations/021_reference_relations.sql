CREATE TABLE reference_relations (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint_low text COLLATE "C" NOT NULL,
  endpoint_high text COLLATE "C" NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,endpoint_low,endpoint_high),
  CHECK(endpoint_low < endpoint_high)
);
CREATE INDEX reference_relations_high ON reference_relations(project_id,endpoint_high,endpoint_low);
ALTER TABLE commands ADD COLUMN before_relations jsonb;
ALTER TABLE commands ADD COLUMN after_relations jsonb;
