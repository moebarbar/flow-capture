# FlowCapture Master Plan — "Make It Perfect"

Status: proposed 2026-07-01. Execute phases in order; each phase leaves the app deployable.
Source of truth for what's broken: full-codebase audit (server, client, extension) on 2026-07-01.

---

## Phase 1 — Fix production-broken systems (billing, storage, config)

The app is deployed on Railway but two core systems still assume Replit infrastructure.

### 1.1 Object storage (currently: screenshots stored as base64 in Postgres)
`server/replit_integrations/object_storage/objectStorage.ts` is hardwired to the Replit
sidecar (`127.0.0.1:1106`), which doesn't exist on Railway. The extension falls back to
inline data URLs → screenshots bloat the DB and every guide fetch.

- [ ] Rewrite the storage client to standard GCS auth: `GCS_BUCKET` + service-account JSON
      via `GOOGLE_APPLICATION_CREDENTIALS_JSON` env (parse and pass `credentials` to the
      `Storage` constructor). Keep the same presigned-URL interface so callers don't change.
      (Alternative if no GCP account: S3-compatible driver pointed at Cloudflare R2 —
      `@uppy/aws-s3` on the client already speaks S3 presigned PUTs.)
- [ ] Add auth + workspace ACL to `/api/uploads/request-url` and `/objects/:path`
      (currently the Replit boilerplate with a TODO). Objects should be readable only via
      signed URLs or scoped ownership checks; public share pages get long-lived signed URLs.
- [ ] Migration script: find steps where `imageUrl` starts with `data:`, upload to bucket,
      rewrite `imageUrl`, vacuum. Run once after deploy.
- [ ] Keep the extension's data-URL fallback but log loudly server-side when it's used.
- [ ] Voiceover service uses the same storage — verify `PRIVATE_OBJECT_DIR` path logic
      still works, or simplify to a plain prefix convention.

**Done when:** a capture on production stores PNGs in the bucket, guides load images via
signed/served URLs, and no new `data:` URLs appear in the `steps` table.

### 1.2 Stripe billing (currently: webhooks crash, Pro checkout cannot succeed)
Three intertwined breaks:
1. `server/webhookHandlers.ts` → `getStripeSync()` returns `null` (stub) → null deref on
   every webhook. Subscription state never updates.
2. `server/stripeService.ts` reads a `stripe.*` Postgres mirror schema only Replit's sync
   populated — empty on Railway.
3. `billingService.getProPriceIds()` matches prices by amount (2300/700) but
   `scripts/seed-products.ts` seeds $19/$49 tiers — nothing matches, Pro checkout throws.

**Decision (recommended): one canonical model — Free + Pro (base $23/mo + $7/seat/mo).**
It's what `billingService.ts` and the seat-limit enforcement already implement; the $19/$49
Free/Pro/Team seeding and the pricing page are the odd ones out. (Flag: final price points
are a business call — trivial to change constants later.)

- [ ] Rewrite webhook handling: `stripe.webhooks.constructEvent(rawBody, sig,
      STRIPE_WEBHOOK_SECRET)` in `index.ts` route → dispatch
      `customer.subscription.created|updated|deleted`, `checkout.session.completed`,
      `invoice.payment_failed` to `billingService.handleSubscriptionUpdated/Deleted`
      (they exist, currently unwired). Delete `stripe-replit-sync` dependency and
      `getStripeSync` entirely.
- [ ] Replace all `SELECT ... FROM stripe.*` mirror queries in `stripeService.ts` with live
      Stripe API calls (memoized ~60s for product/price lists). Admin finance tab reads the
      same service.
- [ ] Stop matching prices by `unit_amount`. Create the base + seat prices once via an
      idempotent setup script (lookup by `lookup_key`), store price IDs in
      `STRIPE_BASE_PRICE_ID` / `STRIPE_SEAT_PRICE_ID` env (with lookup_key fallback).
      Rewrite `scripts/seed-products.ts` to seed exactly this model.
- [ ] Fix `baseUrl` in `/api/checkout` and `/api/billing/portal` to use `APP_URL` first,
      `REPLIT_DOMAINS` only as legacy fallback.
- [ ] Reconcile `pricing.tsx` and the landing-page pricing section with the real model
      (Free + Pro w/ seats; remove Team tier or mark "contact us").
- [ ] End-to-end test in Stripe test mode with `stripe listen` forwarding: checkout →
      webhook → `userSubscriptions` row correct → seat add/remove → cancel → downgrade.

**Done when:** a test-mode user can upgrade to Pro, invite members beyond free limits,
see status in Settings, manage via portal, and cancel — with `userSubscriptions` staying
consistent throughout.

### 1.3 Configuration hygiene
- [ ] Single `server/config.ts`: zod-validated env at boot with clear startup errors
      listing missing vars; kill scattered `process.env` reads.
- [ ] Guard `lib/anthropic.ts` client construction (currently throws at import if
      `ANTHROPIC_API_KEY` unset) — lazy init like the OpenAI client fix.
- [ ] Remove `.replit`, `replit.md` staleness (see 5.4), `stripe-replit-sync` from
      package.json, and dead deps.

---

## Phase 2 — Extension: bulletproof capture

### 2.1 Repo hygiene (prevents a broken store submission)
- [ ] Delete dead v1 files: root-level `content.js`, `background.js`, `overlay.js`,
      `selector.js`, `screenshot.js`, `messaging.js`, `styles.css` (~1,275 lines, referenced
      by nothing).
- [ ] Fix `extension/scripts/build.cjs`: it zips a nonexistent `src/` dir and omits every
      live directory — a build today ships a non-functional extension. Package:
      `manifest.json, icons/, background/, content/, overlay/, popup/, tab-selector/, shared/`.
- [ ] Delete `sidepanel/` (declared but `chrome.sidePanel.open()` is never called; it's a
      stale parallel implementation pointing at the old Replit URL) and drop the
      `sidePanel` permission. The real panel is the injected Shadow-DOM one.
- [ ] Rewrite `extension/README.md` (documents the dead v1 layout).
- [ ] Delete the disabled MutationObserver auto-step block in `capture-agent.js` and the
      orphaned `prepareScreenshotAndCapture`/`pendingScreenshots` machinery in the SW.

### 2.2 Upload reliability (the real risk of data loss)
The elaborate offline queue in `background/sync-manager.js` is bypassed: `stopCapture`
batch-uploads in a plain for-loop; a failed step is `console.error`'d and lost.

- [ ] Route the stop-time batch through `SyncManager.enqueueStep` → `processQueue`
      (persistent queue in `chrome.storage.local`, retry w/ backoff, auth-expiry handling).
- [ ] Surface progress + failures in the side panel and popup (per-step badges exist);
      "3 of 12 steps failed — Retry" affordance instead of silent loss.
- [ ] Fix multipart helpers in sync-manager to use `buildFetchOptions` (currently hardcode
      cookies and never send the Bearer token).
- [ ] Unify duplicated logic: one trusted-origins list (in `shared/types.js` — add the
      missing `.up.railway.app`), one `MessageTypes` source, one dataUrl→blob/compress util.

### 2.3 Screenshot/crop correctness
- [ ] Re-measure the element rect immediately before `captureVisibleTab` (post-rAF), not at
      click time — fixes off-target click indicators when the page scrolls/animates after
      click. Clamp crop rect to image bounds; verify DPR math on 1x/2x displays.
- [ ] Skip the click-indicator overlay for masked/password steps.

### 2.4 Feature completion or removal
- [ ] "Capture Single Element" popup button sends `{singleElement:true}` that the SW
      ignores; the `capture-element-during-recording` button has no listener. Either
      implement single-element mode (crop-only capture of one picked element into the
      Screenshot Studio) or remove both buttons. Recommended: implement — it feeds the
      already-built Screenshot Studio.
- [ ] Full manual QA pass with `extension/TESTING_CHECKLIST.md` across: SPA nav, iframes,
      Shadow DOM, multi-tab flows, service-worker restart mid-capture, offline stop.

---

## Phase 3 — Editor: close the design/implementation gap

A dozen fully-built components + design docs exist but were never wired in.

### 3.1 Real screenshot annotations (biggest visible quality jump)
- [ ] Replace the hard-coded "Click here" overlay in `GuideEditor.tsx` (~line 1384) with an
      indicator positioned from the step's real `metadata.elementBounds`/rect (already
      captured by the extension and burned into the crop — for non-cropped/replaced images,
      compute from metadata).
- [ ] Wire `AnnotationToolbar.tsx` (518 lines, unused): arrows, boxes, text, blur regions;
      persist annotations to step `metadata.annotations`; render them in editor, share,
      embed, and all exports (SOP/PDF/etc.).
- [ ] Wire `ElementHighlightOverlay`/`ElementZoomAnimation` consistently in viewer pages.

### 3.2 Wire the orphaned collaboration components
- [ ] `StepComments.tsx` → right panel tab (API + `stepComments` table incl. edit-proposals
      already exist).
- [ ] `StepAssignmentPanel.tsx` + `ApprovalWorkflowPanel.tsx` → editor header/panel
      (backend routes exist; TeamDashboard already lists them).
- [ ] `VersionHistoryDialog.tsx` standalone → replace the inline duplicate defined inside
      `GuideEditor.tsx` (~line 2036).
- [ ] `ElementIntelligencePanel.tsx` → collapsible "Element details" section in the right
      panel per its design doc (`docs/ELEMENT_INTELLIGENCE_PANEL.md`).
- [ ] `SyncStatusIndicator` / `RecordingIndicator` → show during active capture sessions.
- [ ] Delete whatever we decide not to ship (don't leave orphans).

### 3.3 UX bugs and stubs
- [ ] Post-login redirect goes to `/dashboard` — route doesn't exist (dashboard is `/`).
      Fix `AuthPage.tsx` `setLocation` calls.
- [ ] Editor header "Publish" button has no onClick — wire to the status toggle mutation
      (same one the flows-list dropdown uses).
- [ ] Workspace switcher: sidebar dropdown items are non-functional and every page assumes
      `workspaces[0]`. Add an active-workspace context (persisted in localStorage) +
      working "Create Workspace" flow, thread it through the domain hooks.
- [ ] Stop sending `createdById: "current-user"` placeholder from `Dashboard.tsx` /
      `GuidesList.tsx`; server derives from session — remove from client payload and from
      the accepted input schema.
- [ ] Remove external runtime asset deps: `grainy-gradients.vercel.app/noise.svg` and
      `placehold.co` → bundle local assets.
- [ ] Blog has two sources of truth (static `src/data/blogArticles.ts` vs
      `/api/admin/blog-posts`). Keep the DB-backed one; migrate the static articles in as
      seed data; delete the static file.
- [ ] Remove the legacy `/api/login` redirect links on `LandingPage`/`pricing`
      (Replit-auth leftovers) → link to `/auth`.

---

## Phase 4 — Platform hardening (security, tenancy, real features)

### 4.1 Security & multi-tenancy audit
- [ ] Systematic workspace-scoping review of every route in `server/routes.ts`: confirm
      each guide/step/comment/etc. handler verifies the resource belongs to a workspace
      the session user is a member of (the #1 SaaS data-leak class). Write a small helper
      (`assertWorkspaceAccess`) and use it uniformly.
- [ ] Client-side admin gate on `admin.tsx` (`user.role === 'admin'`) — today any logged-in
      user renders the whole admin UI (server blocks the APIs, but don't show it).
- [ ] Review `frameguard: false` (set globally for embeds) → scope frame-ancestor
      allowance to `/embed/*` + `/share/*` only via per-route CSP.
- [ ] Object-storage ACL (from 1.1), rate limits on auth + AI routes verified, bcrypt
      rounds, session cookie flags, HMAC token expiry/rotation review.
- [ ] Dependency audit (`npm audit`) + remove unused deps.

### 4.2 Make redaction real
Current "redaction" regexes step text and stores placeholder x/y coords — it does not
touch the image.
- [ ] Detection: send the screenshot to Claude vision asking for bounding boxes of visible
      sensitive data (emails, names, tokens, card numbers) → store as % regions.
- [ ] Application: burn blur/pixelate/box into a derived image server-side (`sharp`) at
      share/export time, keeping the original for the editor. Render region overlays live
      in the editor via the existing `RedactionPanel`.

### 4.3 Finish the automation/integration layer
- [ ] Implement `executeEmailAction` (SendGrid, reuse emailService templates) and
      `executeNotifyAction` (insert into `notifications` + SSE push) — both are
      console.log stubs.
- [ ] Reconcile `integrationProviderEnum` (schema) with `integrationProviders.ts` registry:
      add enum values for trello/asana/hubspot, drop or implement
      clickup/monday/dropbox/zapier/make/amplitude/google_analytics. Update the
      IntegrationsPage catalog to only show working providers.
- [ ] Webhook delivery: verify HMAC signing docs + add a "recent deliveries" view (logs
      table exists).

### 4.4 Architecture cleanup
- [ ] Split the 5,400-line `server/routes.ts` into per-domain routers (guides, steps,
      workspaces, billing, admin, kb, integrations, capture, ai) mounted from a thin
      registrar. Pure mechanical move + shared middleware.
- [ ] SSE + rate limiting are in-memory (fine single-instance). Document the constraint;
      if Railway scales horizontally later: Postgres LISTEN/NOTIFY for SSE, shared store
      for rate limits. Not blocking now.
- [ ] Standardize on the `flows` naming in code (keep DB names via Drizzle mapping);
      remove half the alias exports in `shared/schema.ts` where trivially safe.
- [ ] Model config: move hardcoded model IDs (`claude-sonnet-4-6`, `gpt-5.1`, `tts-1`)
      into config with env overrides.
- [ ] Fix `translationService.ts` JSON parsing to strip code fences like the other
      services (known fragility).

---

## Phase 5 — Quality infrastructure: tests, CI, observability, docs

- [ ] `tsc --noEmit` clean; add ESLint + Prettier; fix fallout.
- [ ] Unit tests (vitest): billing math + plan limits, extension-token HMAC
      sign/verify/expiry, translation source-hash skip logic, selector generation
      (port key `capture-agent` fns into testable module), webhook signature handling.
- [ ] API integration tests (supertest + ephemeral Postgres): auth lifecycle, workspace
      ACL (the Phase-4.1 matrix, as tests), guide/step CRUD, share password flow,
      capture-session lifecycle.
- [ ] Playwright e2e: register → create flow → (mock-extension postMessage) capture →
      edit → share → public view → embed. Second suite loads the real extension in
      Chromium and captures a demo page end-to-end.
- [ ] GitHub Actions CI: typecheck + lint + unit + integration on PR; build artifact +
      extension zip on main.
- [ ] Observability: structured logger (pino), Sentry (server + client), keep
      `/api/health`, add DB + storage checks to it.
- [ ] Docs: rewrite stale `replit.md` → proper `README.md` + `CLAUDE.md` (auth is
      email/password not Replit; AI is Claude not OpenAI; Railway deploy steps; env var
      table). Update `docs/*` files that describe unshipped designs to match what Phase 3
      actually wired in.
- [ ] Performance pass: thumbnails for step lists (don't load full screenshots in the
      timeline), image `loading=lazy`, verify pagination on guides list, bundle check.

---

## Sequencing & effort (rough)

| Phase | Scope | Est. sessions |
|-------|-------|---------------|
| 1 | Billing + storage + config | 2–3 |
| 2 | Extension hygiene + reliability | 2–3 |
| 3 | Editor completion | 3–4 |
| 4 | Hardening + real redaction + automations | 3–4 |
| 5 | Tests/CI/docs/perf | 2–3 |

Dependencies: 1 before everything (unbreaks prod). 2.2 before 2.4. 3.1 benefits from 2.3
(correct rects). 4.1 audit informs 5 (tests encode the matrix). Everything else parallel.

## Open business decisions (defaults chosen, cheap to change)
1. **Pricing**: standardized on Pro = $23 base + $7/seat (what the code implements).
2. **Storage**: GCS with a real service account (lib already present). R2/S3 is the
   fallback if no GCP billing account.
3. **Single-element capture**: implement (feeds Screenshot Studio) rather than remove.
