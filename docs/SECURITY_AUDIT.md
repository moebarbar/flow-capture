# FlowCapture Security Audit — 2026-07-02

Read-only audit across 5 attack surfaces (auth/session, multi-tenancy/IDOR,
injection/SSRF, extension/CORS, secrets/storage/DoS) + dependency scan.
Findings deduplicated and ranked. `file:line` refs are from the audited commit.

Status legend: [ ] open · [x] fixed · [~] partially mitigated

---

## CRITICAL

- [~] **C1. Live GCP service-account key in repo root** — `plannedia-b825475c926a.json`
  (real `service_account` private key, project `plannedia`). Not git-tracked and
  never in history, but `.gitignore` was malformed and didn't exclude it.
  **Done:** `.gitignore` fixed so it (and `.env`/`*.key`) can't be committed.
  **You must still:** rotate/revoke this key in GCP (assume exposed), then delete
  the file. Load creds via `GCS_SERVICE_ACCOUNT_JSON` env (already supported).

- [ ] **C2. Workspace takeover via invitation creation** — `POST /api/workspaces/:id/invitations`
  (routes.ts:3281; invitationService.ts:24). No membership/role check; `role`
  taken from body (can be `owner`); the invite **token is returned in the HTTP
  response**. Accept only checks the accepting email == invite email (attacker
  controls both). Any user → owner of any workspace.
  Fix: require `checkWorkspaceAccess(userId, id, ['owner','admin'])`; forbid
  granting `owner` unless caller is owner; stop returning the raw token.

- [ ] **C3. Step edit/delete/reorder IDOR** — `PUT /api/steps/:id` (544),
  `DELETE /api/steps/:id` (562), `POST /api/steps/reorder` (568). Only
  `isAuthenticated`; no ownership lookup (step create at 474 *does* check).
  Any user can overwrite/destroy/reorder any guide's steps.
  Fix: load step → guide → `canManageGuideShare(userId, step.flowId)`; for
  reorder validate every stepId.

- [ ] **C4. Stored XSS via Knowledge Base articles** — `POST/PATCH /api/kb/articles`
  (routes.ts:4864, 4902) store `content` raw (content-pages ARE sanitized — KB
  was missed). Rendered via `dangerouslySetInnerHTML` (KnowledgeBaseArticle.tsx:174,
  KnowledgeBaseEmbed.tsx:77); public read at GET /api/kb/articles/:slug. Any
  logged-in user publishes `<img src=x onerror=...>` → runs in every visitor's
  (and admin's) browser.
  Fix: `sanitizeHtml()` on write in both handlers; require author/admin to publish.

- [ ] **C5. Extension token exfiltration via attacker-controlled `apiBaseUrl`** —
  service-worker.js:663 (`START_CAPTURE_SESSION` via onMessageExternal) sets
  `apiBaseUrl` from the message and calls `createGuideOnServer()` which fetches
  `${apiBaseUrl}/api/workspaces/:id/guides` with `Authorization: Bearer <30-day
  token>` (sync-manager.js:48 attaches it unconditionally). `externally_connectable`
  + `isOriginTrusted` allow wildcard shared hosts (`*.up.railway.app`, `*.replit.*`).
  Attacker at `evil.up.railway.app` → victim's token in one message, no gesture.
  Fix: pin API origin to a build-time constant; restrict `externally_connectable`/
  `host_permissions`/`isOriginTrusted` to exact prod origin(s); never send the
  Bearer to any other origin. (Closes C5 + H10 together.)

---

## HIGH

- [ ] **H1. Public object serving + user-controlled Content-Type = stored XSS &
  no tenant isolation** — `GET /objects/*` (object_storage/routes.ts:53) has no
  auth/ACL (the whole objectAcl.ts is dead code on read). Presigned PUT binds no
  content-type, so a user uploads `text/html`; it's served same-origin as HTML →
  JS in app origin. Screenshots may hold sensitive captured data.
  Fix: force `Content-Disposition: attachment` + safe content-type allowlist;
  bind content-type/size in the signed URL; enforce `canAccessObject` for private
  objects (or serve via short-lived signed URLs).

- [ ] **H2. Read-SSRF via webhooks** — integrationsService.ts:104 `fetch(webhook.url)`
  with no validation; response body stored (webhookLogs) and retrievable via
  `GET .../webhooks/:id/logs`. Owner/admin points url at `169.254.169.254` /
  localhost / private IP → cloud metadata & internal responses exfiltrated.
  Fix: validate on create + before fetch — https only, resolve DNS, block
  private/loopback/link-local, `redirect:'error'`, timeout; don't persist raw body.

- [ ] **H3. SSRF via automation webhook action** — integrationsService.ts:313
  (`executeWebhookAction`), same missing validation, fired on workspace events.
  Fix: same allowlist/deny-private-range validation as H2.

- [ ] **H4. Password-protected share bypass** — `GET /api/share/:token/demo`
  (routes.ts:4562) checks `enabled` but never `passwordHash`; returns full guide +
  steps. Sibling `/verify` and `/embed` gate correctly.
  Fix: require verified password when `share.passwordHash` set.

- [ ] **H5. Redaction removal IDOR** — `PATCH/DELETE/POST /api/redactions/:id[/toggle]`
  (routes.ts:1775, 1792, 1808), only `isAuthenticated`. Attacker disables/removes
  blur regions covering passwords/PII on any guide, then reads via share/embed.
  Fix: region → step → guide → `canManageGuideShare`.

- [ ] **H6. Workspace settings read/write by anyone** — `GET/PATCH
  /api/workspaces/:id/settings` (routes.ts:3244, 3268), no check. Read brand/
  customDomain; flip `autoRedactPasswords:false`, set customDomain on any workspace.
  Fix: `canAccessWorkspace` (GET) / `['owner','admin']` (PATCH).

- [ ] **H7. Guide/step creation into arbitrary workspaces** — `POST /api/flows`
  (147), `POST /api/extension/sync-capture` (2993), `POST /api/templates/:id/use`
  (3223) use body `workspaceId` with no `canAccessWorkspace`. Data/phishing
  injection + storage/AI cost abuse into others' workspaces.
  Fix: `canAccessWorkspace(userId, workspaceId)` (editor+) before create.

- [ ] **H8. Cross-tenant analytics read** — `GET /api/analytics?workspaceId=`
  (routes.ts:3055) no check (the `/workspaces/:id/analytics` variant IS guarded).
  Fix: `canAccessWorkspace`.

- [ ] **H9. AI batch mutation w/o access check** — `POST /api/guides/:guideId/
  generate-all-descriptions` (routes.ts:1250). Overwrite all steps + burn AI
  budget on any guide. Fix: `canManageGuideShare`.

- [ ] **H10. Wildcard trusted origins in extension** — capture-agent.js:55
  `isOriginTrusted` suffix-matches `.up.railway.app`/`.replit.*`; content script on
  `<all_urls>`. Attacker subdomain drives `FLOWCAPTURE_SET_SESSION` etc. See C5 fix.

- [ ] **H11. Secrets/PII captured into step metadata** — capture-agent.js:514
  `getVisibleText` returns `input.value` (incl. **cleartext passwords** w/o
  placeholder) into `elementMetadata.innerText`; `handleInput` runs for password
  fields (only the *screenshot* is skipped, not metadata); pastedText/fileNames
  too. Uploaded to server. Screenshot masking is moot.
  Fix: never emit `input.value` for INPUT; exclude sensitive fields from metadata.

- [ ] **H12. Host-header injection in reset/verification email links** —
  auth/routes.ts:211, 283 build base URL from `req.get("host")` (bypassing the
  existing `getAppBaseUrl()`). Spoofed Host → victim's reset email points at
  attacker → token theft → account takeover.
  Fix: use `getAppBaseUrl()`/`APP_URL`, not the request host.

- [ ] **H13. AI rate limiter mounted on non-existent routes** — routes.ts:83
  mounts `aiLimiter` on `/api/chat` & `/api/image/generate` which don't exist;
  real expensive routes (`/api/generate-image`, `/api/conversations/:id/messages`,
  translate, voiceover, generate-all-descriptions) get only 100/min. Cost-abuse.
  Fix: mount aiLimiter on the real paths.

- [ ] **H14. Tokens & password hashes written to stdout** — index.ts:156 logs full
  JSON response bodies. Captures `extensionToken`/capture `token` (routes.ts:331,
  1863, 1987) and — via `PATCH /api/admin/users/:id` `res.json(updatedUser)`
  (2299, unstripped) — `passwordHash`. 30-day tokens live in logs.
  Fix: don't log response bodies (or redact token/password keys); strip
  passwordHash from the admin PATCH response.

- [ ] **H15. Extension Bearer token non-revocable & outlives credentials** —
  replitAuth.ts:37. Stateless 30-day HMAC; logout/password-reset don't invalidate;
  only lever is rotating SESSION_SECRET (kills all sessions).
  Fix: add revocable `tokenVersion`/jti checked per request; bump on logout/reset.

---

## MEDIUM

- [ ] **M1. CSRF only on `/api/auth/*`; cookies `SameSite=None`** — index.ts:59.
  urlencoded enabled → form-POST "simple requests" hit any non-auth mutation with
  the victim's cookie (e.g. add-member). Fix: Origin check on all mutating /api,
  or SameSite=Lax + rely on Bearer for extension.
- [ ] **M2. Any chrome-extension is a trusted credentialed origin** — index.ts:35
  reflects any `chrome-extension://` with ACAC:true; CSRF whitelists them. Any
  installed extension can mint a 30-day token / read guides. Fix: pin exact ext ID.
- [ ] **M3. Whole app framable → clickjacking** — routes.ts:36 `frameguard:false`,
  CSP off, no `frame-ancestors`. Fix: helmet CSP `frame-ancestors 'self'` globally,
  relax only for `/embed` + `/share`.
- [ ] **M4. Presigned upload has no size/content-type limit** — objectStorage.ts:251.
  Arbitrary large + arbitrary type (feeds H1). Fix: bind content-length-range +
  content-type in signed URL.
- [ ] **M5. Blind SSRF via vision screenshot fetch** — visionService.ts:40 fetches
  user `step.imageUrl`. Fix: restrict to own object-storage origin / block private.
- [ ] **M6. Teams webhook allowlist substring bypass** — integrationProviders.ts:155
  `includes('microsoft.com')` → `http://169.254.169.254/#microsoft.com`. Fix:
  parse URL, exact hostname allowlist, https.
- [ ] **M7. HTML injection in guide HTML/markdown export** — routes.ts:1038, 5316.
  Unescaped title/description/imageUrl into text/html (served as attachment). Fix:
  HTML-escape interpolated fields.
- [ ] **M8. Cross-tenant metadata reads (batch)** — all `isAuthenticated`-only,
  no workspace scoping: invitations list (3310), guide assignments (3423), comments
  read (3718, 3730), translations (1456), voiceovers (1562), redaction locations
  (1661, 1676), folders read+create (576, 583). Fix: canAccessGuide/Workspace each.
- [ ] **M9. 50MB body limit + rawBody double-buffer = memory DoS** — index.ts:123.
  Fix: scope 50MB to upload routes; drop rawBody outside webhook.
- [ ] **M10. Error handler `throw err` after response** — index.ts:185 → possible
  unhandled exception / worker crash. Fix: log instead of throw.
- [ ] **M11. In-memory rate-limit store on autoscale** — per-instance; auth limiter
  weaker at N instances, resets on redeploy. Fix: shared store (Redis/Postgres).
- [ ] **M12. Password reset doesn't invalidate sessions/tokens** — emailService.ts:314.
  Fix: delete user's session rows + bump token version on reset.
- [ ] **M13. Broken fail-closed authz (wrong `(req.user as any).id`, always
  undefined)** — improve-guide (1383), translate (1503), delete-translations (1534),
  step voiceover (1596), guide voiceovers (1637), detect-sensitive (1707), create
  redaction (1745). Denies everyone incl. owners (features broken). Fix: use
  `user.claims.sub` — but keep the membership check when repairing.

---

## LOW

- [ ] **L1. Account enumeration** — register returns "account already exists"
  (routes.ts:53); login timing differs (bcrypt only when user exists, 124). Fix:
  generic messages + dummy compare on not-found.
- [ ] **L2. `SESSION_SECRET` no strength requirement** — config.ts:13 `min(1)`;
  signs sessions AND extension HMAC. Fix: `min(32)`.
- [ ] **L3. Email verification issued but never enforced** — no route requires
  `emailVerifiedAt`. Fix: gate sensitive actions if that's the policy.
- [ ] **L4. `verify-email` unbounded bcrypt token scan, not on authLimiter** —
  emailService.ts:122. Fix: index by lookup prefix; add authLimiter.
- [ ] **L5. `FLOWCAPTURE_IFRAME_STEP` accepted from any origin** —
  capture-agent.js:1618, no origin/source check → step injection. Fix: verify origin.
- [ ] **L6. `notifications/:id/read` no ownership check** — routes.ts:3891. Fix:
  verify notification.userId == claims.sub.
- [ ] **L7. Blog content stored unsanitized** — routes.ts:2361 (admin-only, limited
  render). Sanitize on write for consistency.
- [ ] **L8. Dead v1 extension code ships** — root-level content.js/background.js/etc.
  unreferenced but packaged. Delete / exclude from build (also Phase 2 hygiene).
- [ ] **L9. Capture status info leak** — routes.ts:1972 reveals session existence
  for any guideId (token withheld). Minor.

---

## Dependency vulnerabilities (`npm audit`)

28 prod (2 critical, 11 high) / 31 incl. dev. Notable:
- **CRITICAL** jspdf (PDF injection → arbitrary JS in generated PDFs) — client export.
- **CRITICAL** fast-xml-parser (entity-encoding bypass) — transitive.
- **HIGH** ws (uninitialized memory disclosure / DoS) — `npm audit fix` available.
- **HIGH** axios (NO_PROXY SSRF), express-rate-limit (IPv6 bypass — N/A: default
  keygen used), path-to-regexp / minimatch / picomatch (ReDoS), preact, rollup/vite
  (path traversal — dev only).
- drizzle-orm SQL-injection-via-identifiers advisory: **not exploitable here** —
  no user input is used as a SQL identifier (verified).
Plan: `npm audit fix` for the safe set (ws, yaml, etc.); evaluate jspdf upgrade;
pin/upgrade axios & transitive gaxios/uuid.

---

## Verified CLEAN (no action)
- No SQL injection: all `sql\`\`` parameterized, no `sql.raw()`/concatenation.
- Reset-token crypto: 256-bit CSPRNG, bcrypt-hashed at rest, single-use, 1h expiry.
- No hardcoded secrets in source or git history; no server secret is `VITE_`-prefixed.
- SendGrid uses structured API (no header injection); bcrypt cost 12.
- Stripe webhook signature verified on raw body; extension token uses timingSafeEqual.
- Object keys are random UUIDs (no overwrite across tenants); upload endpoint authed.
- No server-side zip/archiver usage; HTML-export filename sanitized (no traversal).

---

## Suggested remediation order
1. **C1** rotate GCP key (you — needs GCP access). `.gitignore` already fixed.
2. **C2–C5** — takeover/IDOR/XSS/token-theft: highest blast radius, mostly small diffs.
3. **H1, H4, H5, H6, H7, H8, H9** — the IDOR/access-control cluster: add the
   existing `canAccessWorkspace`/`canManageGuideShare` helpers uniformly.
4. **H2, H3, M5, M6** — SSRF: one shared URL-validation util.
5. **H11, H12, H13, H14, H15** — extension secret capture, host-header, cost limits,
   token logging, token revocation.
6. **M/L batch** + dependency fixes.
