ALTER TABLE conversation_drafts ADD COLUMN composer jsonb NOT NULL DEFAULT '{}'::jsonb;
