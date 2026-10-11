# Publishing: immutable snapshot foundation

Date: 2026-09-16. Implementation checkpoint: T49/T50, not completed Web publication.

## Implemented boundary

- Owner-authorized `GET /api/projects/:id/publish-check`, `GET /api/projects/:id/versions`, and `POST /api/projects/:id/versions`.
- Freeze input is only commandId + sourceRevision. The server locks the owned project row, verifies revision and current reachable graph, and creates the snapshot and pinned asset references in one transaction. Exact retries return the same version identity; altered reuse is rejected. Project undo/redo does not include published versions.
- Shared graph validation now detects nonfinite, negative and out-of-scene active clip times. Existing entry/output/group/overlap/asset diagnostics remain shared with preview. Only reachable active references are collected; hidden tracks, disabled clips, unused scenes and author references are excluded from media access checks.
- Storage checks use the configured private S3 endpoint with four concurrent HEAD requests and a common ten-second deadline. Expected size must match. This is an availability/size check of already ingested immutable media, not a new decode or checksum check. A build must recheck resource access and its actual produced manifest before marking ready. Storage errors are mapped to clip-local diagnostics without returning keys or internal endpoints.
- Snapshot serialization uses the shared NodeTimeline v2 normalizer, then explicitly emits playback fields. It omits scene prose, references, selection, layout, bookmarks, original filenames, source paths, posters and arbitrary extra data. Media sources use future version-scoped stable routes. Private storage identities are pinned separately and not returned by version-list APIs.
- Migration 004 protects snapshot/identity updates and asset-reference updates with database triggers. Asset foreign keys prevent deleting media still referenced by a version. Current service exposes no deletion route.

## Current UX and recovery

The publish page shows checks, precise scene/clip links, privately fixed versions and their source revision. It refuses a stale check after the draft advances. A request ID and revision are saved in per-owner/project sessionStorage before submitting, so a lost response or reload can retry the same command; storage write failure prevents submission. This journal has no content or credentials.

A fixed version is currently **pending and private**. There is no builder, anonymous player endpoint, ready transition or share link in this checkpoint. The screen states this explicitly. Do not interpret freeze as consent to expose a work publicly: future publishing must add the required share-scope confirmation and a separate explicit activation/build action. In particular, do not automatically publish already-created pending snapshots when a worker is first installed.

## Next dependent slices

1. Add build leases/recovery, a pinned manifest, storage health checks and retry on the same snapshot. Worker inputs must never reload the current draft.
2. Add version-specific anonymous playback and only the pinned media routes, using the existing compiler/runtime. Restrict all access until a confirmed build is ready.
3. Add sharing-scope confirmation, explicit build activation, failure/retry UI and true version URL navigation. Verify old-version isolation and failure safety with real artifacts.
4. Finish region-review flags with replacement adoption; test issue-link repair, browser reload/lost-response, four widths, mobile/touch/audio, and uploaded-media end-to-end publication.

The current environment is local. No public deployment, paid provider call or private project exposure has occurred.

## Build/player increment (2026-09-16, supersedes the earlier “no builder” checkpoint)

Migration 005 adds an explicit unlisted-sharing confirmation record and durable build queue. Private snapshot creation still does not enqueue or expose anything. `POST /api/projects/:projectId/versions/:versionId/build` requires owner authorization, Origin, command ID, expected build generation and `shareScope: unlisted`. The browser displays who can access the version before the first request. Retries retain the exact request identity in sessionStorage; a generation check prevents stale or duplicate requeueing.

`npm run worker:publish` claims only confirmed queue rows with a three-minute lease and unique token. A crashed worker's expired job may be reclaimed, with at most five interrupted attempts before manual retry. Each run uses the frozen snapshot and pinned references, never the current project document. It validates the shared graph contract, checks media HEAD size and a real single-byte GET, then writes a version/generation/token-specific playback manifest to private S3. It reads the manifest back and verifies SHA-256 before atomically recording the artifact and setting the version ready. Completion/failure is fenced by generation, lease token and lease expiry. Orphaned artifacts from a superseded attempt remain private; automated retention cleanup is not yet implemented.

A failed build does not update any other version. Manual retry retains the same snapshot but increments build generation; already-ready versions cannot be requeued. Error output is generic and contains no internal address or storage key.

The published artifact contains the sanitized NodeTimeline v2 graph and an explicit public media manifest. The independent Next.js route `/p/:versionId` loads only a confirmed, ready artifact, verifies its hash, and uses the same PlayerOverlay/compiler/runtime as author preview. The application supplies runtime format version 1; this is a hosted player, not a standalone downloaded HTML/ZIP export. Playback runtime code is supplied by the application deployment, so future runtime changes must remain compatible with existing format-1 releases and pass their regression fixtures.

Anonymous `/api/published/:versionId/assets/:assetId` authorizes each request against that ready version's pinned media. It has no bucket-list, draft, conversation or project-management access. Shared media serving preserves validated Range handling, content type, nosniff and inline disposition; published media has a five-minute cache lifetime. Private editor media remains private/no-store.

The player requires an initial user action, gives a retry control for video/audio play rejection or media errors, freezes the interval clock during this failure state, and keeps landing-page controls out of the focus order during playback. Exit restores focus to Start. Published ratio is read from the frozen snapshot. Actual device-specific autoplay, audio and touch behavior still requires mobile/browser acceptance.

Local QA version `8cdbc6da-72f6-4e23-8567-26b96d0beaba` was explicitly activated through its confirmation flow and is now ready, source r36; draft remains r38. This is an agent-created synthetic test-pattern work served only by the development service on 127.0.0.1. No public host was provisioned and no Internet deployment occurred.

Remaining: formal deployment target and share origin, retention/garbage collection, monitoring and worker supervision, runtime version compatibility policy, broader QTE/region and browser/mobile acceptance, and the complete M4 acceptance matrix. Completed local publication is not the whole P0 delivery.
