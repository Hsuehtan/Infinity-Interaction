-- Deployment key setup requires no application account. Existing attribution stays intact.
-- Personal configuration services continue recording and checking their authenticated owner.
ALTER TABLE model_credentials ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE builtin_provider_bindings ALTER COLUMN created_by DROP NOT NULL;
