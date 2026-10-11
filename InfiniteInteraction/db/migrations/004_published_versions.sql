CREATE TABLE published_versions (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK(version_number > 0),
  source_revision integer NOT NULL CHECK(source_revision >= 0),
  command_id uuid NOT NULL,
  request_hash text NOT NULL,
  snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','building','ready','failed')),
  error text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,version_number),
  UNIQUE(project_id,command_id)
);
CREATE TABLE published_version_assets (
  version_id uuid NOT NULL REFERENCES published_versions(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id),
  storage_key text NOT NULL,
  media_type text NOT NULL CHECK(media_type IN ('video','image','audio')),
  metadata jsonb NOT NULL,
  PRIMARY KEY(version_id,asset_id)
);
CREATE FUNCTION protect_published_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status','error']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','error']) THEN
    RAISE EXCEPTION 'Published snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER published_snapshot_immutable BEFORE UPDATE ON published_versions
FOR EACH ROW EXECUTE FUNCTION protect_published_snapshot();
CREATE FUNCTION protect_published_asset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published asset reference is immutable';
END;
$$;
CREATE TRIGGER published_asset_immutable BEFORE UPDATE ON published_version_assets
FOR EACH ROW EXECUTE FUNCTION protect_published_asset();
