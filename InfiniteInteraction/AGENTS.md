# Infinite Interaction engineering

- Production code lives only in this directory. Per the user's 2026-10-07 decision, ../OpenFMV, ../MVPdemo and ../UXdemo are historical demo/reference projects: every file, including documentation, samples, dependencies, caches and Git metadata, is P3. Their read-only protection is revoked. Subsequent explicit authorization permits verified P2/P3 archival and source removal under ../docs/specs/11-p2-p3-archive.md; recovery is indexed in ../tasks/reports/p2-p3-archive-2026-10-07.md. This does not authorize unrelated deletions or business-code changes.
- Retain OpenFMV MIT attribution, NodeTimeline v2 and shared runtime; do not build a second timeline engine.
- Specs: ../docs/specs. Execution: ../tasks/plan.md and ../tasks/todo.md. User approval to develop has been given.
- PostgreSQL is authoritative. Commands require owner authorization, idempotency and server revision. UI selection never mutates project revision.
- Browser never receives secrets or local-machine APIs. Development credentials must remain local.
- Use npm run typecheck / lint / test:run / test:integration / build. Run dev and build serially (shared .next).
- The former source-protection gate is retired. npm run verify:protected remains a compatibility command that reports "retired", not a successful integrity check. Preserve historical evidence and keep unresolved requirements explicit.
