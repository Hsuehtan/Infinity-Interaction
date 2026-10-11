-- Workshop and project/scene form input now lives only in the active component.
-- Existing unsent drafts are intentionally discarded instead of becoming messages.
DROP TABLE conversation_draft_commands;
DROP TABLE conversation_drafts;
