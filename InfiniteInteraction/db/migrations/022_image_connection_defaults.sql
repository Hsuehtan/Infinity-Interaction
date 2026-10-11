ALTER TABLE model_connections ADD COLUMN output_kind text NOT NULL DEFAULT 'video' CHECK(output_kind IN ('video','image'));
DROP INDEX model_single_default;
CREATE UNIQUE INDEX model_single_default_per_output ON model_connections(output_kind) WHERE is_default;
