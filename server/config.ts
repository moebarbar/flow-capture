import { z } from "zod";

/**
 * Central environment configuration. Validated once at boot so misconfiguration
 * fails loudly at startup instead of deep inside a request handler.
 */
const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().positive().optional(),

  // Required core
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Postgres connection string)"),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required (session cookies + extension token signing)"),

  // Public URL of the deployed app, e.g. https://flow-capture-production.up.railway.app
  APP_URL: z.string().url().optional(),
  // Legacy Replit domains list (comma-separated hostnames)
  REPLIT_DOMAINS: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_BASE_PRICE_ID: z.string().optional(),
  STRIPE_SEAT_PRICE_ID: z.string().optional(),

  // Object storage (Google Cloud Storage)
  GCS_BUCKET: z.string().optional(),
  GCS_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS_JSON: z.string().optional(),
  // Legacy Replit object storage vars (still honored)
  DEFAULT_OBJECT_STORAGE_BUCKET_ID: z.string().optional(),
  PRIVATE_OBJECT_DIR: z.string().optional(),
  PUBLIC_OBJECT_SEARCH_PATHS: z.string().optional(),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_INTEGRATIONS_OPENAI_API_KEY: z.string().optional(),
  AI_INTEGRATIONS_OPENAI_BASE_URL: z.string().optional(),

  // Email
  SENDGRID_API_KEY: z.string().optional(),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

export const env = loadEnv();

/**
 * AI model IDs, overridable via env so upgrades don't require code changes.
 */
export const models = {
  claudeText: process.env.AI_MODEL_CLAUDE_TEXT || "claude-sonnet-4-6",
  claudeVision: process.env.AI_MODEL_CLAUDE_VISION || "claude-sonnet-4-6",
  claudeFast: process.env.AI_MODEL_CLAUDE_FAST || "claude-haiku-4-5-20251001",
  openaiChat: process.env.AI_MODEL_OPENAI_CHAT || "gpt-5.1",
  openaiImage: process.env.AI_MODEL_OPENAI_IMAGE || "gpt-image-1",
  openaiTts: process.env.AI_MODEL_OPENAI_TTS || "tts-1",
};

/** Which optional feature groups are usable with the current env. */
export const features = {
  stripe: !!env.STRIPE_SECRET_KEY,
  stripeWebhooks: !!env.STRIPE_SECRET_KEY && !!env.STRIPE_WEBHOOK_SECRET,
  objectStorage:
    !!(env.GCS_BUCKET || env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || env.PRIVATE_OBJECT_DIR) &&
    !!(
      env.GCS_SERVICE_ACCOUNT_JSON ||
      env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
      env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.REPL_ID
    ),
  anthropic: !!env.ANTHROPIC_API_KEY,
  openai: !!(env.OPENAI_API_KEY || env.AI_INTEGRATIONS_OPENAI_API_KEY),
  email: !!env.SENDGRID_API_KEY,
};

export function logFeatureSummary(log: (msg: string) => void) {
  const flag = (on: boolean) => (on ? "on" : "off");
  log(
    `features: stripe=${flag(features.stripe)} webhooks=${flag(features.stripeWebhooks)} ` +
      `storage=${flag(features.objectStorage)} claude=${flag(features.anthropic)} ` +
      `openai=${flag(features.openai)} email=${flag(features.email)}`,
  );
  if (!features.objectStorage) {
    log("WARNING: object storage not configured — screenshots fall back to inline data URLs (set GCS_BUCKET + GCS_SERVICE_ACCOUNT_JSON)");
  }
  if (features.stripe && !features.stripeWebhooks) {
    log("WARNING: STRIPE_WEBHOOK_SECRET not set — subscription changes will not sync from Stripe");
  }
}

/**
 * Public base URL for links we generate (share links, checkout redirects).
 * Priority: APP_URL → legacy REPLIT_DOMAINS → the request's own host.
 */
export function getAppBaseUrl(req?: {
  secure?: boolean;
  headers?: Record<string, unknown>;
  get?: (header: string) => string | undefined;
}): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "");

  const replitDomain = env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (replitDomain) return `https://${replitDomain}`;

  const host = req?.get?.("host");
  if (host) {
    const forwardedProto = req?.headers?.["x-forwarded-proto"];
    const isHttps = req?.secure || forwardedProto === "https";
    return `${isHttps ? "https" : "http"}://${host}`;
  }

  return `http://localhost:${env.PORT || 5000}`;
}
