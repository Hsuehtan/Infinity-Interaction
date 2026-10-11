# Legacy project import decisions

Date: 2026-09-16

## Boundary

Import is an explicit migration into a new cloud project. Preview is read-only. A failed preview or commit cannot replace the selected source file, the currently open cloud project, or its local recovery journal.

## Source and recovery

- Accepted source formats are OpenFMV JSON and ZIP, capped at 50 MB compressed input.
- The exact accepted source bytes, filename, SHA-256 and preview report are stored in `project_imports` and can be downloaded only by the project owner.
- The source backup and migrated project records commit in one PostgreSQL transaction. Private media objects created before that transaction are deleted when migration fails.
- `commandId` makes a commit retry return the same project. Reusing it with different bytes is rejected.

## Migration rules

- Project schema version and NodeTimeline version are checked independently. Current support is project schema 1 and NodeTimeline v2.
- Supported graph nodes are `start`, `scene` and `end`. Unsupported gameplay is reported with its source location and blocks commit while the exact original remains recoverable.
- Media identities receive cloud UUIDs; timeline clips and references are rewritten to those IDs. Legacy `src`, `poster`, local paths and `node.video` are not trusted as runtime state.
- SVG assets cannot contain scripts, external references, entities or remote paint URLs. Safe internal paint references are allowed; accepted SVG is rendered to PNG before storage.
- Old paused normal buttons on the same interaction track and exact time window are migrated into one stable choice group.
- Empty start nodes can act as explicit routing/title nodes. Empty ordinary scene nodes remain invalid.

## Open work

- Add a read-only compatibility view for unsupported gameplay instead of blocking at preview.
- Add a relink workflow that lets the author supply missing media and resume the same import report.
- Manually verify the native file chooser on a human-controlled browser; current automation can verify the dialog and all post-selection behavior but cannot operate Codex's own native chooser.
