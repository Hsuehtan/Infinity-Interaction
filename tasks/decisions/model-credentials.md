# Model configuration and credential storage — development implementation

Date: 2026-09-16. Scope: T26–T28 increment; not final production security or provider acceptance.

## Current contract

- Service-instance admin API: GET/POST `/api/admin/model-connections`. Actor and admin role come from the authenticated server session. Mutations enforce the configured request origin and a 32 KiB streaming body bound.
- Each command has a UUID, connection UUID and base version. A single database transaction serializes the instance default and retries. Reusing a command ID for different content is rejected. Configuration versions and credential references are append-only through this service.
- At most one default exists, and it must be enabled and unarchived. Disabling clears default without picking a replacement. Switching defaults creates a new version for the previous default too. Archive requires disable first, hides the connection and preserves all versions and encrypted credentials. There is no destructive credential/history deletion endpoint.
- Only redacted public connection data is returned. `credential: {action: "keep"}` retains the previous credential; the UI maps an empty Key field to keep. `clear` explicitly removes the current credential reference, preserving historical references. `replace` seals a new value. Commands store a request digest and a redacted response, never raw mutation JSON.

## Envelope encryption

AES-256-GCM uses a new 12-byte IV and a 16-byte tag for each credential. Additional authenticated data binds ciphertext to the credential UUID and format version, preventing a ciphertext row from being transplanted to a different identity. Implementation uses Node's authenticated-encryption API; see [Node crypto documentation](https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options).

`MODEL_CREDENTIAL_ACTIVE_KEY` selects a key ID in server-only `MODEL_CREDENTIAL_KEYS_JSON`. Each key is exactly 32 random bytes encoded as Base64. Production must provision these through the deployment secret system, not commit them or expose a NEXT_PUBLIC variable. New replacements use the active key; old versions retain their original key ID. Keep every required older decryption key until dependent history/tasks are safely retired. Removing a required key causes a clear unavailable error, never an unauthenticated decrypt or fallback to another key.

The current developer machine has a locally generated key in ignored `.env.local` with file mode 0600. No key value was printed or added to source control. This is local development infrastructure, not a claim that production secret backups, access auditing, rotation automation or disaster recovery have been accepted.

## Provider and transport boundary

The user's initial supplier choice and paid acceptance budget have been requested and are pending. All four protocol options remain explicitly unadapted; availableForVideo=false. Temperature and Max Tokens are disabled, and extra_body accepts only `{}` until an actual adapter declares a validated schema. Save/enable/default/archive perform no provider requests.

`MODEL_ALLOWED_ORIGINS_JSON` is a deployment-owned exact HTTPS-origin allowlist. Configuration saves reject URL credentials, query/fragment, numeric IPs, localhost/private-name suffixes and nonallowlisted origins. A synthetic `https://video.example.test` origin is allowed on this local acceptance machine only. These checks do not claim to solve execution-time DNS rebinding, address pinning, redirect validation or result-download restrictions; T29 transport must implement those before external execution is enabled.

## Remaining acceptance

- Select and verify a real video adapter, capability schema and prices; obtain explicit paid acceptance budget.
- Bind future jobs and confirmation cards to immutable config/credential versions and add active-job archival policy. No generation jobs exist yet, so that lifecycle cannot be claimed tested.
- First-run developer-config seeding/import, production secret-manager integration, rotation/recovery runbook and audit export.
- Full admin/creator browser and four-width responsive verification. New secret inputs remain page memory only and are cleared on successful save or confirmed close, never included in form-draft recovery exports.

## 2026-09-23 local save repair

User selected https://api.tu-zi.com and MiniMax-H3 for testing. The local allowlist previously contained only the synthetic origin, so this supplier was rejected before credential storage. Added its exact HTTPS origin to ignored `.env.local`, retaining the existing encryption key and file mode 0600. An authenticated route regression covers create, keep, replace and redacted list responses using synthetic credentials; all 7 model integration tests pass. Supplier protocol/capabilities and actual key validity are not verified by saving configuration. The current browser session has no administrator model menu, so real-key entry requires an administrator session.

## 2026-09-26 current implementation audit

The dedicated `tuzi-minimax-h3` video adapter and guarded request/Worker path now exist. `availableForVideo` is derived from connection status, credential presence, a reviewed unexpired price contract, configured limits/result origins, and explicit runtime switches. It does not assert that the supplier accepted a request or that the specific requested shape has a price; confirmation rechecks the exact quote.

Local read-only audit of the current build found two referenced encrypted credential versions, both recoverable with the installed keyring. Removing an old key made its pinned version unavailable, and restoring it recovered that version. `.env.local` remains mode `0600`; no actual credential or encryption-key bytes appeared in application source files, 38 client static bundle files, or existing acceptance logs. This is local evidence only. Production execution of the seed, secret-manager backup/restore and deployment log access remain open T26 work.

## 2026-09-26 first-run seed command

An explicit `npm run models:seed` command now reads a developer-owned JSON file in the shape of [model-bootstrap.example.json](../../InfiniteInteraction/config/model-bootstrap.example.json). Set `MODEL_CONNECTION_BOOTSTRAP_FILE` to its absolute path, `MODEL_CONNECTION_BOOTSTRAP_ADMIN_USERNAME` to an existing administrator, and each entry's `credentialEnv` variable through the deployment secret system. The JSON file contains only an environment-variable name, never the key value. The example is disabled and is not run automatically.

The command creates only missing stable connection IDs under the same database advisory lock used by page edits. If an ID already exists, it skips it before reading the old environment variable or revalidating stale file settings, so reruns cannot overwrite a later UI version. If a new entry requests default while a database default exists, it reports a conflict and does not switch the existing default. A dedicated CLI subprocess test created a synthetic connection, then verified that a later page edit remained unchanged on rerun even with the original secret variable absent. Production seed execution and secret backup/restore remain separate deployment checks.
