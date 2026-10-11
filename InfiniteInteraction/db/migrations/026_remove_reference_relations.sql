-- The user removed setting-to-setting relationships on 2026-09-29.
-- Remove relationship-only no-op steps from undo/redo; retain command audit rows.
WITH retired AS (
  SELECT project_id,command_id::text AS command_id FROM commands
  WHERE before_document=after_document AND before_relations IS DISTINCT FROM after_relations
)
UPDATE projects p SET
  undo_stack=COALESCE((SELECT jsonb_agg(item.value ORDER BY item.ordinality)
    FROM jsonb_array_elements(p.undo_stack) WITH ORDINALITY item
    WHERE NOT EXISTS(SELECT 1 FROM retired r WHERE r.project_id=p.id AND r.command_id=item.value#>>'{}')),'[]'::jsonb),
  redo_stack=COALESCE((SELECT jsonb_agg(item.value ORDER BY item.ordinality)
    FROM jsonb_array_elements(p.redo_stack) WITH ORDINALITY item
    WHERE NOT EXISTS(SELECT 1 FROM retired r WHERE r.project_id=p.id AND r.command_id=item.value#>>'{}')),'[]'::jsonb)
WHERE EXISTS(SELECT 1 FROM retired r WHERE r.project_id=p.id);
DROP TABLE reference_relations;
ALTER TABLE commands DROP COLUMN before_relations, DROP COLUMN after_relations;
