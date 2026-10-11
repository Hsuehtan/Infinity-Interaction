ALTER TABLE providers ADD COLUMN owner_id uuid REFERENCES users(id);
UPDATE providers SET owner_id=created_by;
ALTER TABLE providers ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE model_connections ADD COLUMN owner_id uuid REFERENCES users(id);
ALTER TABLE model_connections ADD COLUMN source text NOT NULL DEFAULT 'personal' CHECK(source IN ('personal','builtin'));
UPDATE model_connections c SET owner_id=COALESCE((SELECT p.owner_id FROM managed_model_versions m JOIN providers p ON p.id=m.provider_id WHERE m.model_id=c.id AND m.version=c.current_version),c.created_by);
ALTER TABLE model_connections ADD CONSTRAINT model_source_owner CHECK((source='personal' AND owner_id IS NOT NULL) OR (source='builtin' AND owner_id IS NULL));
DROP INDEX model_single_default_per_output;
CREATE UNIQUE INDEX personal_model_default ON model_connections(owner_id,output_kind) WHERE is_default AND source='personal';
CREATE UNIQUE INDEX builtin_model_default ON model_connections(output_kind) WHERE is_default AND source='builtin';
CREATE TABLE builtin_provider_bindings (
 provider_key text NOT NULL, version integer NOT NULL,
 credential_ref uuid NOT NULL REFERENCES model_credentials(id), created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider_key,version)
);
CREATE TABLE builtin_model_versions (
 model_id uuid NOT NULL, version integer NOT NULL, adapter_id text NOT NULL, adapter_version integer NOT NULL,
 capability jsonb NOT NULL, PRIMARY KEY(model_id,version),
 FOREIGN KEY(model_id,version) REFERENCES model_connection_versions(connection_id,version)
);
ALTER TABLE users DROP COLUMN role;
