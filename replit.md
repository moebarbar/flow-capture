# FlowCapture

This file is retained for Replit compatibility. The documentation now lives in:

- **`README.md`** — overview, stack, setup, environment, deployment
- **`CLAUDE.md`** — conventions and gotchas for working in this codebase
- **`docs/MASTER_PLAN.md`** — roadmap and status
- **`docs/SECURITY_AUDIT.md`** — security findings and remediation
- **`extension/README.md`** — Chrome extension architecture

Key facts that used to live here and were out of date:

- Auth is **email/password** (bcrypt + Postgres sessions), not Replit Auth.
- AI is **Anthropic Claude** (vision/descriptions/translation/redaction) and
  **OpenAI** (voiceover/chat/image), not OpenAI-only.
- Deployment target is **Railway**, not Replit.
