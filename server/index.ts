import express, { type Request, Response, NextFunction } from "express";
import { logFeatureSummary } from "./config";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { WebhookHandlers } from "./webhookHandlers";
import { emailService } from "./services/emailService";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Build the explicit allowlist of web-app origins.
// chrome-extension:// origins are always allowed (they can't be spoofed).
// Web origins: only the exact APP_URL env var and any REPLIT_DOMAINS entries.
const ALLOWED_WEB_ORIGINS = new Set<string>(
  [
    process.env.APP_URL,
    ...(process.env.REPLIT_DOMAINS?.split(",").map((d) => `https://${d.trim()}`) ?? []),
    // Allow localhost for development
    "http://localhost:5000",
    "http://localhost:3000",
  ].filter(Boolean) as string[]
);

// CORS middleware for Chrome extension support
app.use((req, res, next) => {
  const origin = req.headers.origin;

  const isAllowed =
    origin &&
    (origin.startsWith("chrome-extension://") ||
      ALLOWED_WEB_ORIGINS.has(origin));

  if (isAllowed) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).send();
  }

  next();
});

// CSRF protection for state-changing auth endpoints.
// Strategy: verify the Origin/Referer on ALL state-changing /api requests.
// This protects against cross-origin cookie-based CSRF (session cookies are
// sameSite=none in production so the extension can use them). Bearer-token
// requests are exempt — an attacker's page can't forge the Authorization header.
// Public server-to-server / cross-origin endpoints are explicitly exempted.
const CSRF_EXEMPT_PREFIXES = [
  "/api/stripe/webhook", // Stripe server-to-server, signature-verified
  "/api/analytics/track", // public beacon, no auth/cookies of value
];
app.use("/api", (req, res, next) => {
  if (["GET", "OPTIONS", "HEAD"].includes(req.method)) return next();

  // req.path here is relative to the /api mount, so re-derive the full path
  const fullPath = req.baseUrl + req.path;
  if (CSRF_EXEMPT_PREFIXES.some((p) => fullPath.startsWith(p))) return next();

  // Bearer-token requests are not CSRF-vulnerable (attacker can't forge them)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Same-origin requests (no Origin header) are fine
  if (!origin && !referer) return next();

  let requestOrigin: string | null = null;
  try {
    requestOrigin = origin || (referer ? new URL(referer).origin : null);
  } catch {
    return res.status(403).json({ message: "CSRF check failed" });
  }
  if (!requestOrigin) return next();

  // Always allow chrome-extension origins
  if (requestOrigin.startsWith("chrome-extension://")) return next();

  // Allow if in the explicit allowlist
  if (ALLOWED_WEB_ORIGINS.has(requestOrigin)) return next();

  // Allow if the origin matches the request's own host (handles Railway, any deployment)
  const host = req.headers.host;
  if (host) {
    const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const selfOrigin = `${proto}://${host}`;
    if (requestOrigin === selfOrigin) return next();
  }

  return res.status(403).json({ message: "CSRF check failed" });
});

// Stripe webhook route MUST be before express.json() middleware
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
// Increase limit to 50MB for image uploads
app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Redact credential-bearing fields before logging; never log tokens/hashes
        const SENSITIVE = ["token", "extensionToken", "passwordHash", "password", "secret"];
        const redacted = JSON.stringify(capturedJsonResponse, (key, value) =>
          SENSITIVE.includes(key) && value ? "[redacted]" : value,
        );
        const preview = redacted.length > 500 ? `${redacted.slice(0, 500)}…` : redacted;
        logLine += ` :: ${preview}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize email service (non-fatal — app works without SendGrid)
  emailService.initialize().then((ok) => {
    if (ok) {
      log("Email service initialized (SendGrid ready)");
    } else {
      log("Email service not configured — set SENDGRID_API_KEY to enable emails");
    }
  });

  logFeatureSummary(log);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
