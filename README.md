# FlowCapture

A Tango/Scribe-style SaaS for automated workflow documentation. A Chrome
extension records browser interactions (clicks, inputs, navigation) with a
screenshot per action, and the platform turns them into step-by-step guides
("Flows") enriched by AI — with team workspaces, sharing/embedding,
translations, voiceovers, real redaction, a knowledge base, integrations, and
Stripe billing.

## Stack

- **Frontend**: React 18 + Vite + Wouter + TanStack Query + Tailwind + shadcn/ui
  (`client/`)
- **Backend**: Express 4 + TypeScript, PostgreSQL via Drizzle ORM (`server/`,
  `shared/`)
- **Extension**: Chrome Manifest V3 (`extension/`) — see `extension/README.md`
- **AI**: Anthropic Claude (vision, step descriptions, guide intelligence,
  translation, redaction detection); OpenAI (TTS voiceover, chat assistant,
  image gen)
- **Storage**: Google Cloud Storage (screenshots, audio, redacted images)
- **Auth**: email/password (bcrypt) with Postgres-backed sessions + a revocable
  HMAC bearer token for the extension
- **Payments**: Stripe (Free + Pro at $23/mo base + $7/seat)
- **Deploy**: Railway (`railway.toml`, nixpacks)

> Note: this project began on Replit and retains some `replit_integrations/`
> module structure, but it no longer depends on Replit at runtime — auth is
> email/password (not Replit Auth) and AI is Claude/OpenAI directly.

## Local development

```bash
npm install
# Provide at minimum DATABASE_URL and SESSION_SECRET (see Environment below)
npm run db:push        # create/update tables
npm run dev            # tsx + Vite on http://localhost:5000
```

The server validates its environment at boot (`server/config.ts`) and logs a
feature summary showing which integrations are active.

## Environment

Required:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | Session cookie + extension-token signing (use ≥32 random chars) |
| `APP_URL` | Public app URL (used for links, checkout redirects, email) |

Optional (features degrade gracefully when unset):

| Var | Enables |
|-----|---------|
| `GCS_BUCKET`, `GCS_SERVICE_ACCOUNT_JSON` | Object storage (else screenshots inline in DB) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing + subscription sync |
| `STRIPE_BASE_PRICE_ID`, `STRIPE_SEAT_PRICE_ID` | Pin Pro prices (else resolved by lookup key) |
| `ANTHROPIC_API_KEY` | Claude features (vision, descriptions, translate, redaction) |
| `OPENAI_API_KEY` | Voiceover (TTS), chat, image gen |
| `SENDGRID_API_KEY` | Transactional email (verification, reset, invites) |
| `AI_MODEL_*` | Override model IDs (see `server/config.ts`) |

## Scripts

```bash
npm run dev                 # dev server (tsx + Vite)
npm run build               # Vite client build + esbuild server bundle → dist/
npm start                   # run the production bundle
npm run check               # tsc --noEmit (clean)
npm run db:push             # drizzle-kit push
npm run stripe:setup        # idempotently create Stripe products/prices
npm run migrate:screenshots # move inline base64 screenshots to GCS
```

## Deploy (Railway)

`railway.toml` runs `drizzle-kit push --force` then `node dist/index.cjs` on
each deploy. After setting env vars:

1. Object storage: create a GCS bucket + service account, set `GCS_BUCKET` and
   `GCS_SERVICE_ACCOUNT_JSON`, then run `npm run migrate:screenshots` once.
2. Billing: set `STRIPE_SECRET_KEY`, run `npm run stripe:setup`, add a webhook
   endpoint at `<APP_URL>/api/stripe/webhook` (events: `checkout.session.completed`,
   `customer.subscription.*`, `invoice.payment_failed`), set `STRIPE_WEBHOOK_SECRET`.
3. Set `APP_URL` to the Railway URL.

The extension's pinned production origin lives in `extension/manifest.json` and
`extension/background/service-worker.js` — update both if the domain changes.

## Layout

```
client/     React app (pages/, components/, hooks/, lib/)
server/     Express API (routes.ts, services/, replit_integrations/, config.ts)
shared/     Drizzle schema + typed route contracts (schema.ts, routes.ts, models/)
extension/  Chrome MV3 extension (see its own README)
scripts/    One-off scripts (stripe setup, screenshot migration, seed)
docs/       MASTER_PLAN.md (roadmap), SECURITY_AUDIT.md, design notes
```

## Security

A full audit and the remediation status live in `docs/SECURITY_AUDIT.md`.
Highlights of what's enforced: per-workspace access checks on all resource
routes, revocable extension tokens, SSRF-guarded outbound fetches, CSRF origin
checks on mutations, sanitized user HTML, real (pixel-destroying) redaction, and
object serving that neutralizes uploaded HTML/SVG.
