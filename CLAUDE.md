# CLAUDE.md — working notes for agents

See `README.md` for setup and `docs/MASTER_PLAN.md` for the roadmap. This file
captures the non-obvious conventions.

## Naming: flows vs guides (important)

The product was renamed "guides → flows" but table/column names were kept to
avoid destructive migrations:

- `flows` model → **table `guides`**; `flowId` field → **column `guide_id`**.
- API URLs use `:guideId`; the DB/backend property is `flowId`.
- Step create/update input schemas **omit `flowId`** — the server derives it
  from the URL param. Never send `flowId`/`guideId` in step request bodies.
- `shared/schema.ts` exports back-compat aliases (`guides = flows`, etc.).

## Auth

- Web app: email/password (bcrypt), Passport + Postgres-backed sessions. **Not
  Replit Auth** (the `/api/login` OAuth routes just redirect to `/auth`).
- Extension: HMAC bearer token (`createExtensionToken`/`issueExtensionToken`),
  **revocable** via `users.token_version` (bumped on logout/password reset).
- Session user shape: `req.user.claims.sub` is the user id. Do **not** use
  `req.user.id` (it's undefined — this bug fails authz closed).
- `isAuthenticated` middleware accepts session OR bearer. Many routes instead
  inline `req.isAuthenticated()` (session only) — bearer-authed extension
  endpoints must use the middleware.

## Access control

- Helpers in `server/routes.ts`: `canAccessWorkspace`, `canAccessGuide`,
  `canManageGuideShare` (editor+), `checkWorkspaceAccess(userId, wsId, roles)`.
  They're hoisted `async function`s — callable from any route in the file.
- Every workspace-scoped route must verify membership. The security pass added
  these broadly; keep the pattern when adding routes.

## AI

- Models are configured in `server/config.ts` (`models.*`, `AI_MODEL_*` env
  overrides). Don't hardcode model IDs.
- Parse model JSON with `parseModelJson()` (`server/lib/modelJson.ts`) — strips
  code fences.
- The Anthropic client (`server/lib/anthropic.ts`) is lazy; importing it never
  throws when the key is missing.

## Object storage & redaction

- `objectStorageService` (`server/replit_integrations/object_storage/`) works
  with GCS via service-account JSON, or falls back to inline data URLs when
  unconfigured. `saveObject`/`readObjectBuffer` are the buffer helpers.
- Redaction is real: `redactionService.renderStepRedaction` burns regions into
  a derived image with `sharp` and stores it at
  `step.metadata.redactedImageUrl`. Public share/embed/export serve that in
  place of the original; the editor shows the original.

## Extension

- Live code is under `extension/{background,content,overlay,popup,tab-selector,
  shared}/`. Root-level `*.js` files were dead v1 and are deleted.
- Trusted origins are pinned exactly (no wildcards) in `manifest.json`,
  `content/capture-agent.js`, `shared/types.js`, and
  `background/service-worker.js`. Update all of them together on a domain change.
- Capture is local-first; the stop-time upload runs through the SyncManager
  retry queue (`background/sync-manager.js`).

## Gotchas

- SSE and rate limiting are in-memory (single-instance). Documented, not yet
  distributed.
- `tsc --noEmit` is clean — keep it that way.
- Build marks native deps (e.g. `sharp`) external; they load from node_modules
  at runtime.
